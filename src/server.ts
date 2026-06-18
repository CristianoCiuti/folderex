import express from "express";
import { createServer } from "http";
import { resolve, join, relative, extname, basename } from "path";
import { readdirSync, statSync, existsSync, watch } from "fs";
import mime from "mime-types";
import { WebSocketServer, WebSocket } from "ws";
import { ZipArchive } from "archiver";
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
