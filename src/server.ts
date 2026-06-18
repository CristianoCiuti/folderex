import express from "express";
import { createServer } from "http";
import { resolve, join, relative, extname, basename } from "path";
import { readdirSync, statSync, existsSync, watch, unlinkSync, rmSync, renameSync } from "fs";
import mime from "mime-types";
import { WebSocketServer, WebSocket } from "ws";
import { ZipArchive } from "archiver";
import multer from "multer";
import { renderDirectory } from "./template.js";

export interface ServerOptions {
  root: string;
  user: string;
  pass: string;
  port: number;
}

export interface ServerResult {
  url: string;
  port: number;
}

function checkAuth(
  authHeader: string | undefined,
  user: string,
  pass: string
): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
  const [u, p] = credentials.split(":");
  return u === user && p === pass;
}

export function startServer(options: ServerOptions): Promise<ServerResult> {
  const { root, user, pass, port } = options;
  const app = express();
  const httpServer = createServer(app);

  // --- Shared clipboard state ---
  let clipboardText = "";

  // --- WebSocket server ---
  const wss = new WebSocketServer({ server: httpServer, path: "/__ws" });

  wss.on("connection", (ws, req) => {
    // Auth check on upgrade
    if (!checkAuth(req.headers.authorization, user, pass)) {
      ws.close(1008, "Unauthorized");
      return;
    }

    // Send current clipboard state on connect
    ws.send(JSON.stringify({ type: "clipboard", text: clipboardText }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "clipboard" && typeof msg.text === "string") {
          clipboardText = msg.text;
          // Broadcast to all OTHER connected clients
          for (const client of wss.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "clipboard", text: clipboardText }));
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });
  });

  // --- File watcher with debounce ---
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    watch(root, { recursive: true }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const msg = JSON.stringify({ type: "fschange" });
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        }
      }, 500);
    });
  } catch {
    // fs.watch may fail on some systems; non-critical feature
  }

  // Basic auth middleware
  app.use((req, res, next) => {
    if (!checkAuth(req.headers.authorization, user, pass)) {
      res.setHeader("WWW-Authenticate", 'Basic realm="folderex"');
      res.status(401).send("Authentication required");
      return;
    }
    next();
  });

  // JSON body parser (for delete API)
  app.use(express.json());

  // --- Multer for file uploads (temp storage, then move to target) ---
  const upload = multer({ dest: join(root, ".folderex-uploads-tmp") });

  // --- Delete API ---
  app.delete("/__api/delete", (req, res) => {
    const { path: filePath } = req.body as { path?: string };
    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "Missing path" });
      return;
    }

    const fsPath = resolve(join(root, filePath));

    // Security: prevent path traversal
    if (!fsPath.startsWith(resolve(root))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!existsSync(fsPath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const stat = statSync(fsPath);
      if (stat.isDirectory()) {
        rmSync(fsPath, { recursive: true });
      } else {
        unlinkSync(fsPath);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Delete failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Upload API ---
  app.post("/__api/upload", upload.array("files"), (req, res) => {
    const targetDir = (req.body?.path as string) || "/";
    const overwrite = req.body?.overwrite === "true";
    const fsDir = resolve(join(root, targetDir));

    // Security: prevent path traversal
    if (!fsDir.startsWith(resolve(root))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!existsSync(fsDir) || !statSync(fsDir).isDirectory()) {
      res.status(400).json({ error: "Target directory does not exist" });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    // Check for conflicts (only when overwrite is not set)
    if (!overwrite) {
      const conflicts: string[] = [];
      for (const file of files) {
        const dest = join(fsDir, file.originalname);
        if (existsSync(dest)) {
          conflicts.push(file.originalname);
        }
      }
      if (conflicts.length > 0) {
        // Clean up temp files
        for (const file of files) {
          try { unlinkSync(file.path); } catch {}
        }
        res.status(409).json({ error: "exists", conflicts });
        return;
      }
    }

    // Move files from temp to target
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const dest = join(fsDir, file.originalname);
        renameSync(file.path, dest);
        uploaded.push(file.originalname);
      }
      res.json({ ok: true, files: uploaded });
    } catch (err) {
      // Clean up remaining temp files
      for (const file of files) {
        try { unlinkSync(file.path); } catch {}
      }
      res.status(500).json({ error: "Upload failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Download route (must be before catch-all) ---
  app.get("/__download/*", (req, res) => {
    const urlPath = decodeURIComponent(req.path.replace(/^\/__download/, "") || "/");
    const fsPath = resolve(join(root, urlPath));

    // Security: prevent path traversal
    if (!fsPath.startsWith(resolve(root))) {
      res.status(403).send("Forbidden");
      return;
    }

    if (!existsSync(fsPath)) {
      res.status(404).send("Not found");
      return;
    }

    const stat = statSync(fsPath);

    if (stat.isDirectory()) {
      // Zip the folder and stream it
      const folderName = basename(fsPath) || "download";
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folderName}.zip"`
      );

      const archive = new ZipArchive({ zlib: { level: 5 } });
      archive.on("error", (err: Error) => {
        res.status(500).send("Archive error: " + err.message);
      });
      archive.pipe(res);
      archive.directory(fsPath, folderName);
      archive.finalize();
    } else {
      // Force download for any file
      const fileName = basename(fsPath);
      const contentType =
        mime.contentType(extname(fsPath)) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.sendFile(fsPath);
    }
  });

  // File serving + directory browsing
  app.get("*", (req, res) => {
    const urlPath = decodeURIComponent(req.path);
    const fsPath = resolve(join(root, urlPath));

    // Security: prevent path traversal
    if (!fsPath.startsWith(resolve(root))) {
      res.status(403).send("Forbidden");
      return;
    }

    if (!existsSync(fsPath)) {
      res.status(404).send("Not found");
      return;
    }

    const stat = statSync(fsPath);

    if (stat.isDirectory()) {
      // Ensure trailing slash for directories
      if (!req.path.endsWith("/")) {
        res.redirect(req.path + "/");
        return;
      }

      const entries = readdirSync(fsPath).map((name) => {
        const entryPath = join(fsPath, name);
        try {
          const entryStat = statSync(entryPath);
          return {
            name,
            isDirectory: entryStat.isDirectory(),
            size: entryStat.size,
            modified: entryStat.mtime,
          };
        } catch {
          return {
            name,
            isDirectory: false,
            size: 0,
            modified: new Date(),
          };
        }
      });

      // Sort: directories first, then alphabetical
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const relPath = relative(root, fsPath) || "/";
      const breadcrumbs = buildBreadcrumbs(urlPath);

      const html = renderDirectory({
        entries,
        path: relPath === "/" ? "/" : `/${relPath}/`,
        breadcrumbs,
      });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    }

    // Serve file
    const contentType =
      mime.contentType(extname(fsPath)) || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // For download, set filename
    const fileName = basename(fsPath);
    if (
      !contentType.startsWith("text/") &&
      !contentType.startsWith("image/") &&
      !contentType.includes("pdf") &&
      !contentType.includes("json")
    ) {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
    }

    res.sendFile(fsPath);
  });

  return new Promise((resolvePromise, reject) => {
    httpServer.listen(port, () => {
      const addr = httpServer.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }
      const actualPort = addr.port;
      resolvePromise({
        url: `http://localhost:${actualPort}`,
        port: actualPort,
      });
    });

    httpServer.on("error", reject);
  });
}

interface Breadcrumb {
  name: string;
  path: string;
}

function buildBreadcrumbs(urlPath: string): Breadcrumb[] {
  const parts = urlPath.split("/").filter(Boolean);
  const crumbs: Breadcrumb[] = [{ name: "~", path: "/" }];

  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    crumbs.push({ name: part, path: `${current}/` });
  }

  return crumbs;
}
