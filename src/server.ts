import express from "express";
import { resolve, join, relative, extname, basename } from "path";
import { readdirSync, statSync, existsSync } from "fs";
import mime from "mime-types";
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

export function startServer(options: ServerOptions): Promise<ServerResult> {
  const { root, user, pass, port } = options;
  const app = express();

  // Basic auth middleware
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="folderex"');
      res.status(401).send("Authentication required");
      return;
    }

    const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
    const [u, p] = credentials.split(":");

    if (u !== user || p !== pass) {
      res.setHeader("WWW-Authenticate", 'Basic realm="folderex"');
      res.status(401).send("Invalid credentials");
      return;
    }

    next();
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
    const server = app.listen(port, () => {
      const addr = server.address();
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

    server.on("error", reject);
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
