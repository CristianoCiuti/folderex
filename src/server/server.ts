import express from "express";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { resolve, join, relative, extname, basename, dirname } from "path";
import { readdirSync, statSync, existsSync, watch, unlinkSync, rmSync, renameSync, mkdirSync, copyFileSync, cpSync } from "fs";
import { fileURLToPath } from "url";
import mime from "mime-types";
import { WebSocketServer, WebSocket } from "ws";
import { ZipArchive } from "archiver";
import multer from "multer";
import { OperationsManager } from "./operations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  const useAuth = !!(user && pass);
  const app = express();
  const httpServer = createServer(app);

  // --- Shared clipboard state ---
  let clipboardText = "";

  // --- WebSocket server ---
  const wss = new WebSocketServer({ server: httpServer, path: "/__ws" });

  // --- Operations manager ---
  const opsManager = new OperationsManager();
  opsManager.setWss(wss);

  wss.on("connection", (ws, req) => {
    // Auth check on upgrade (skip if auth disabled)
    if (useAuth && !checkAuth(req.headers.authorization, user, pass)) {
      ws.close(1008, "Unauthorized");
      return;
    }

    // Send current clipboard state on connect
    ws.send(JSON.stringify({ type: "clipboard", text: clipboardText }));

    // Send current operations state
    const activeOps = opsManager.list();
    if (activeOps.length > 0) {
      ws.send(JSON.stringify({ type: "operations-sync", operations: activeOps }));
    }

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
        // Suppress fschange while operations are running to avoid UI thrashing
        const activeOps = opsManager.list().filter(op => op.status === "active");
        if (activeOps.length > 0) return;

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

  // Basic auth middleware (skip if auth disabled)
  if (useAuth) {
    app.use((req, res, next) => {
      if (!checkAuth(req.headers.authorization, user, pass)) {
        res.setHeader("WWW-Authenticate", 'Basic realm="folderex"');
        res.status(401).send("Authentication required");
        return;
      }
      next();
    });
  }

  // JSON body parser (for delete API)
  app.use(express.json());

  // --- Multer for file uploads (temp in system temp dir) ---
  const uploadTmpDir = join(tmpdir(), "folderex-uploads");
  mkdirSync(uploadTmpDir, { recursive: true });
  const upload = multer({ dest: uploadTmpDir });

  // Pending uploads waiting for overwrite confirmation
  // token -> { files: [{tmpPath, originalname}], targetDir, expires }
  const pendingUploads = new Map<string, {
    files: { tmpPath: string; originalname: string }[];
    targetDir: string;
    expires: number;
  }>();

  // Clean expired pending uploads every 60s
  setInterval(() => {
    const now = Date.now();
    for (const [token, pending] of pendingUploads) {
      if (pending.expires < now) {
        for (const f of pending.files) {
          try { unlinkSync(f.tmpPath); } catch {}
        }
        pendingUploads.delete(token);
      }
    }
  }, 60_000);

  // --- Trash system for undo-delete ---
  const trashBaseDir = join(tmpdir(), "folderex-trash");
  mkdirSync(trashBaseDir, { recursive: true });

  // token -> { originalPath, trashPath, isDirectory, expires }
  const trashedItems = new Map<string, {
    originalPath: string;
    trashPath: string;
    isDirectory: boolean;
    expires: number;
  }>();

  // Purge expired trash items every 30s
  setInterval(() => {
    const now = Date.now();
    for (const [token, item] of trashedItems) {
      if (item.expires < now) {
        try { rmSync(item.trashPath, { recursive: true, force: true }); } catch {}
        trashedItems.delete(token);
      }
    }
  }, 30_000);

  // --- Delete API (moves to trash, with progress for large dirs) ---
  app.delete("/__api/delete", (req, res) => {
    const { path: rawFilePath } = req.body as { path?: string };
    if (!rawFilePath || typeof rawFilePath !== "string") {
      res.status(400).json({ error: "Missing path" });
      return;
    }

    const filePath = decodeURIComponent(rawFilePath);
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
      const token = randomUUID();
      const trashPath = join(trashBaseDir, token);
      const fileName = basename(fsPath);

      // Try fast rename first (same device = instant)
      try {
        renameSync(fsPath, trashPath);
        // Instant — track as a completed operation
        const opId = opsManager.create("delete", `Delete ${fileName}`);
        opsManager.complete(opId);
        trashedItems.set(token, {
          originalPath: fsPath,
          trashPath,
          isDirectory: stat.isDirectory(),
          expires: Date.now() + 60_000,
        });
        res.json({ ok: true, trashToken: token, operationId: opId });
        return;
      } catch {
        // Cross-device: need worker thread
      }

      // Worker thread: copy to trash, then delete original
      const opId = opsManager.runDelete(fsPath, trashPath, `Delete ${fileName}`);

      // Register trash item immediately (worker will complete the operation)
      trashedItems.set(token, {
        originalPath: fsPath,
        trashPath,
        isDirectory: stat.isDirectory(),
        expires: Date.now() + 300_000, // longer timeout for async ops
      });

      res.json({ ok: true, trashToken: token, operationId: opId, async: true });
    } catch (err) {
      res.status(500).json({ error: "Delete failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Restore API (undo delete) ---
  app.post("/__api/restore", (req, res) => {
    const { trashToken } = req.body as { trashToken?: string };
    if (!trashToken || typeof trashToken !== "string") {
      res.status(400).json({ error: "Missing trashToken" });
      return;
    }

    const item = trashedItems.get(trashToken);
    if (!item) {
      res.status(404).json({ error: "Item expired or not found" });
      return;
    }

    try {
      // Ensure parent directory still exists
      const parentDir = resolve(item.originalPath, "..");
      mkdirSync(parentDir, { recursive: true });

      // Move back from trash
      try {
        renameSync(item.trashPath, item.originalPath);
      } catch {
        if (item.isDirectory) {
          mkdirSync(item.originalPath, { recursive: true });
          cpSync(item.trashPath, item.originalPath, { recursive: true });
          rmSync(item.trashPath, { recursive: true, force: true });
        } else {
          copyFileSync(item.trashPath, item.originalPath);
          unlinkSync(item.trashPath);
        }
      }

      trashedItems.delete(trashToken);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Restore failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Rename API ---
  app.post("/__api/rename", (req, res) => {
    const { path: rawFilePath, newName } = req.body as { path?: string; newName?: string };
    if (!rawFilePath || typeof rawFilePath !== "string") {
      res.status(400).json({ error: "Missing path" });
      return;
    }
    if (!newName || typeof newName !== "string" || newName.trim() === "") {
      res.status(400).json({ error: "Missing or empty new name" });
      return;
    }

    // Validate name: no slashes, no path traversal
    const trimmedName = newName.trim();
    if (trimmedName.includes("/") || trimmedName.includes("\\") || trimmedName === "." || trimmedName === "..") {
      res.status(400).json({ error: "Invalid name" });
      return;
    }

    const filePath = decodeURIComponent(rawFilePath);
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

    const parentDir = dirname(fsPath);
    const newFsPath = resolve(join(parentDir, trimmedName));

    // Security: ensure new path is still within root
    if (!newFsPath.startsWith(resolve(root))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Check if target already exists
    if (existsSync(newFsPath)) {
      res.status(409).json({ error: `"${trimmedName}" already exists` });
      return;
    }

    try {
      renameSync(fsPath, newFsPath);
      res.json({ ok: true, newName: trimmedName });
    } catch (err) {
      res.status(500).json({ error: "Rename failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Clone API (duplicate file/directory, worker thread for dirs) ---
  app.post("/__api/clone", (req, res) => {
    const { path: rawFilePath } = req.body as { path?: string };
    if (!rawFilePath || typeof rawFilePath !== "string") {
      res.status(400).json({ error: "Missing path" });
      return;
    }

    const filePath = decodeURIComponent(rawFilePath);
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

    const parentDir = dirname(fsPath);
    const originalName = basename(fsPath);
    const ext = extname(originalName);
    const nameWithoutExt = ext ? originalName.slice(0, -ext.length) : originalName;

    const generateCopyName = (): string => {
      const baseCopy = `${nameWithoutExt}_copy`;
      const firstCandidate = `${baseCopy}${ext}`;
      if (!existsSync(resolve(parentDir, firstCandidate))) return firstCandidate;
      let n = 2;
      while (true) {
        const candidate = `${baseCopy}(${n})${ext}`;
        if (!existsSync(resolve(parentDir, candidate))) return candidate;
        n++;
        if (n > 1000) break;
      }
      return `${baseCopy}(${Date.now()})${ext}`;
    };

    const newName = generateCopyName();
    const newFsPath = resolve(parentDir, newName);

    try {
      const stat = statSync(fsPath);

      if (stat.isDirectory()) {
        // Worker thread for directory copy
        const opId = opsManager.runClone(fsPath, newFsPath, `Duplicate ${originalName}`);
        res.json({ ok: true, newName, operationId: opId, async: true });
      } else {
        // Single file: instant
        copyFileSync(fsPath, newFsPath);
        const opId = opsManager.create("clone", `Duplicate ${originalName}`);
        opsManager.complete(opId);
        res.json({ ok: true, newName, operationId: opId });
      }
    } catch (err) {
      res.status(500).json({ error: "Clone failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Upload API ---
  // Wrap multer to detect client abort and track as cancelled operation
  const uploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Track abort state on the request object so the handler can check it too
    (req as any).__uploadAborted = false;
    (req as any).__uploadOpCreated = false;

    req.on("aborted", () => {
      (req as any).__uploadAborted = true;
      // If the handler already created an op, mark it cancelled
      if ((req as any).__uploadOpId) {
        opsManager.complete((req as any).__uploadOpId, "Cancelled");
        (req as any).__uploadOpCreated = true;
      }
    });

    upload.array("files")(req, res, (err) => {
      if (err) {
        if ((req as any).__uploadAborted || err.message === "Request aborted") {
          // Client cancelled during multer transfer
          if (!(req as any).__uploadOpCreated) {
            const label = (req.body?.label as string) || buildUploadLabel(req.files as Express.Multer.File[] | undefined);
            const clientOpId = req.headers["x-op-id"] as string | undefined;
            // Clean up any partial temp files
            const files = req.files as Express.Multer.File[] | undefined;
            if (files) {
              for (const f of files) {
                try { unlinkSync(f.path); } catch {}
              }
            }
            const opId = opsManager.create("upload", label, clientOpId);
            opsManager.complete(opId, "Cancelled");
          }
          return;
        }
        return next(err);
      }
      next();
    });
  };

  function buildUploadLabel(files: Express.Multer.File[] | undefined | null): string {
    if (!files || files.length === 0) return "Upload";
    const name = files[0].originalname;
    if (!name) return "Upload";
    if (files.length === 1) return `Upload ${name}`;
    return `Upload ${name} +${files.length - 1}`;
  }

  app.post("/__api/upload", uploadMiddleware, (req, res) => {
    // If request was aborted after multer succeeded, don't process
    if ((req as any).__uploadAborted) return;

    const rawTargetDir = (req.body?.path as string) || "/";
    const targetDir = decodeURIComponent(rawTargetDir);
    const overwrite = req.body?.overwrite === "true";
    const pendingToken = req.body?.pendingToken as string | undefined;
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

    // --- Overwrite retry via pending token (no re-upload needed) ---
    if (overwrite && pendingToken) {
      const pending = pendingUploads.get(pendingToken);
      if (!pending) {
        res.status(400).json({ error: "Upload expired, please try again" });
        return;
      }
      pendingUploads.delete(pendingToken);

      const uploadLabel = (req.body?.label as string) || (pending.files.length === 1
        ? `Upload ${pending.files[0].originalname || "file"}`
        : `Upload ${pending.files[0].originalname || "file"} +${pending.files.length - 1}`);
      const clientOpId = req.headers["x-op-id"] as string | undefined;
      const opId = opsManager.create("upload", uploadLabel, clientOpId);

      const uploaded: string[] = [];
      try {
        for (const f of pending.files) {
          const dest = join(pending.targetDir, f.originalname);
          try {
            copyFileSync(f.tmpPath, dest);
          } finally {
            try { unlinkSync(f.tmpPath); } catch {}
          }
          uploaded.push(f.originalname);
        }
        opsManager.complete(opId);
        res.json({ ok: true, files: uploaded, operationId: opId });
      } catch (err) {
        for (const f of pending.files) {
          try { unlinkSync(f.tmpPath); } catch {}
        }
        opsManager.complete(opId, err instanceof Error ? err.message : String(err));
        res.status(500).json({ error: "Upload failed: " + (err instanceof Error ? err.message : String(err)) });
      }
      return;
    }

    // --- Normal upload ---
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const uploadLabel = buildUploadLabel(files);
    const clientOpId = req.headers["x-op-id"] as string | undefined;
    const opId = opsManager.create("upload", uploadLabel, clientOpId);
    (req as any).__uploadOpId = opId;
    (req as any).__uploadOpCreated = true;

    // Check for conflicts
    if (!overwrite) {
      const conflicts: string[] = [];
      for (const file of files) {
        const dest = join(fsDir, file.originalname);
        if (existsSync(dest)) {
          conflicts.push(file.originalname);
        }
      }
      if (conflicts.length > 0) {
        opsManager.complete(opId, "File conflict");
        // Keep temp files and issue a token for retry
        const token = randomUUID();
        pendingUploads.set(token, {
          files: files.map(f => ({ tmpPath: f.path, originalname: f.originalname })),
          targetDir: fsDir,
          expires: Date.now() + 5 * 60_000, // 5 minutes
        });
        res.status(409).json({ error: "exists", conflicts, pendingToken: token, operationId: opId });
        return;
      }
    }

    // Move files from temp to target
    const uploaded: string[] = [];

    try {
      for (const file of files) {
        const dest = join(fsDir, file.originalname);
        try {
          renameSync(file.path, dest);
        } catch {
          // rename fails across devices, fall back to copy+delete
          copyFileSync(file.path, dest);
          unlinkSync(file.path);
        }
        uploaded.push(file.originalname);
      }
      opsManager.complete(opId);
      res.json({ ok: true, files: uploaded, operationId: opId });
    } catch (err) {
      // Clean up remaining temp files
      for (const file of files) {
        try { unlinkSync(file.path); } catch {}
      }
      opsManager.complete(opId, err instanceof Error ? err.message : String(err));
      res.status(500).json({ error: "Upload failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // --- Operations API ---
  app.get("/__api/operations", (_req, res) => {
    res.json({ operations: opsManager.list() });
  });

  app.post("/__api/operations/:id/cancel", (req, res) => {
    const { id } = req.params;
    const cancelled = opsManager.cancel(id);
    if (cancelled) {
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "Operation not found or already completed" });
    }
  });

  app.delete("/__api/operations", (_req, res) => {
    opsManager.clearCompleted();
    res.json({ ok: true });
  });

  // --- Search API (recursive file search with fuzzy subsequence matching) ---
  app.get("/__api/search", (req, res) => {
    const query = ((req.query.q as string) || "").trim().toLowerCase();
    if (!query) {
      res.json({ results: [] });
      return;
    }

    const maxResults = 50;
    const results: { name: string; path: string; isDirectory: boolean; size: number; modified: string; score: number }[] = [];

    // Subsequence match: characters of query must appear in order in target
    function fuzzyMatch(target: string, query: string): { match: boolean; score: number } {
      const targetLower = target.toLowerCase();
      let qi = 0;
      let score = 0;
      let lastMatchIdx = -1;
      for (let ti = 0; ti < targetLower.length && qi < query.length; ti++) {
        if (targetLower[ti] === query[qi]) {
          // Bonus for consecutive matches
          if (lastMatchIdx === ti - 1) score += 5;
          // Bonus for match at start or after separator
          if (ti === 0 || target[ti - 1] === '.' || target[ti - 1] === '-' || target[ti - 1] === '_') score += 3;
          lastMatchIdx = ti;
          qi++;
        }
      }
      if (qi === query.length) {
        // Bonus for shorter names (tighter match)
        score += Math.max(0, 20 - (target.length - query.length));
        return { match: true, score };
      }
      return { match: false, score: 0 };
    }

    function walk(dir: string, relDir: string) {
      if (results.length >= maxResults) return;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        if (results.length >= maxResults) return;
        // Skip hidden files/dirs and node_modules
        if (name.startsWith(".") || name === "node_modules") continue;
        const fullPath = join(dir, name);
        let stat;
        try {
          stat = statSync(fullPath);
        } catch {
          continue;
        }
        const relPath = relDir ? `${relDir}/${name}` : name;
        const { match, score } = fuzzyMatch(name, query);
        if (match) {
          results.push({
            name,
            path: `/${relPath}${stat.isDirectory() ? "/" : ""}`,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            modified: stat.mtime.toISOString(),
            score,
          });
        }
        if (stat.isDirectory()) {
          walk(fullPath, relPath);
        }
      }
    }

    walk(root, "");
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    // Strip score from response
    res.json({ results: results.map(({ score, ...rest }) => rest) });
  });

  // --- List API (returns JSON directory listing for SPA) ---
  app.get("/__api/list", (req, res) => {
    const rawPath = (req.query.path as string) || "/";
    const urlPath = decodeURIComponent(rawPath);
    const fsPath = resolve(join(root, urlPath));

    // Security: prevent path traversal
    if (!fsPath.startsWith(resolve(root))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!existsSync(fsPath) || !statSync(fsPath).isDirectory()) {
      res.status(404).json({ error: "Not found or not a directory" });
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
          modified: entryStat.mtime.toISOString(),
        };
      } catch {
        return {
          name,
          isDirectory: false,
          size: 0,
          modified: new Date().toISOString(),
        };
      }
    });

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const relPath = relative(root, fsPath) || "/";
    const currentPath = relPath === "/" ? "/" : `/${relPath.replace(/\\/g, "/")}/`;
    const breadcrumbs = buildBreadcrumbs(urlPath);

    res.json({
      entries,
      path: currentPath,
      breadcrumbs,
    });
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
      // Force download — dotfiles get .txt suffix (like GitHub)
      const fileName = basename(fsPath);
      const downloadName = fileName.startsWith(".") ? fileName + ".txt" : fileName;
      res.download(fsPath, downloadName, { dotfiles: "allow" }, (err) => {
        if (err && !res.headersSent) {
          res.status(500).send("Download failed");
        }
      });
    }
  });

  // --- Serve SPA static files ---
  const clientDir = join(__dirname, "client");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false }));
  }

  // File serving + SPA fallback
  app.get("*", (req, res) => {
    const urlPath = decodeURIComponent(req.path);
    const fsPath = resolve(join(root, urlPath));

    // Security: prevent path traversal
    if (!fsPath.startsWith(resolve(root))) {
      res.status(403).send("Forbidden");
      return;
    }

    if (!existsSync(fsPath)) {
      // If path doesn't exist on filesystem, serve SPA (it handles routing)
      const indexPath = join(clientDir, "index.html");
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Not found");
      }
      return;
    }

    const stat = statSync(fsPath);

    if (stat.isDirectory()) {
      // Ensure trailing slash for directories
      if (!req.path.endsWith("/")) {
        res.redirect(req.path + "/");
        return;
      }

      // Serve the SPA — it will call /__api/list to get the directory contents
      const indexPath = join(clientDir, "index.html");
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send("SPA not built. Run: npm run build:client");
      }
      return;
    }

    // Serve file
    const contentType =
      mime.contentType(extname(fsPath)) || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // For non-inline types, force download with filename
    const fileName = basename(fsPath);
    const isInline =
      contentType.startsWith("text/") ||
      contentType.startsWith("image/") ||
      contentType.includes("pdf") ||
      contentType.includes("json");

    if (fileName.startsWith(".")) {
      // Dotfiles: always force download with .txt suffix (browsers strip leading dots)
      const downloadName = fileName + ".txt";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadName}"`
      );
    } else if (!isInline) {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
    }

    res.sendFile(fsPath, { dotfiles: "allow" });
  });

  // --- Suppress aborted request errors ---
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.message === "Request aborted") {
      // Client disconnected — already handled by upload middleware
      return;
    }
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
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
