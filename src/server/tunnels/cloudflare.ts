import { spawn, ChildProcess } from "child_process";
import { existsSync, mkdirSync, createWriteStream, chmodSync } from "fs";
import { join } from "path";
import { homedir, platform, arch } from "os";
import https from "https";
import { extractTarGz } from "../utils/extract.js";

const CLOUDFLARED_DIR = join(homedir(), ".folderex", "bin");

function getCloudflaredInfo(): { url: string; filename: string } {
  const p = platform();
  const a = arch();

  const base = "https://github.com/cloudflare/cloudflared/releases/latest/download";

  if (p === "win32") {
    if (a === "x64") return { url: `${base}/cloudflared-windows-amd64.exe`, filename: "cloudflared.exe" };
    return { url: `${base}/cloudflared-windows-386.exe`, filename: "cloudflared.exe" };
  }

  if (p === "darwin") {
    if (a === "arm64") return { url: `${base}/cloudflared-darwin-arm64.tgz`, filename: "cloudflared" };
    return { url: `${base}/cloudflared-darwin-amd64.tgz`, filename: "cloudflared" };
  }

  // Linux
  if (a === "arm64") return { url: `${base}/cloudflared-linux-arm64`, filename: "cloudflared" };
  if (a === "arm") return { url: `${base}/cloudflared-linux-arm`, filename: "cloudflared" };
  return { url: `${base}/cloudflared-linux-amd64`, filename: "cloudflared" };
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (url: string, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const file = createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          file.close();
          reject(err);
        });
      }).on("error", reject);
    };

    follow(url);
  });
}

async function ensureCloudflared(): Promise<string> {
  const { url, filename } = getCloudflaredInfo();
  const binPath = join(CLOUDFLARED_DIR, filename);

  if (existsSync(binPath)) {
    return binPath;
  }

  mkdirSync(CLOUDFLARED_DIR, { recursive: true });

  const isTgz = url.endsWith(".tgz");

  if (isTgz) {
    // For macOS .tgz downloads
    const tgzPath = join(CLOUDFLARED_DIR, "cloudflared.tgz");
    await downloadFile(url, tgzPath);

    await extractTarGz(tgzPath, CLOUDFLARED_DIR);

    // Clean up
    const { unlinkSync } = await import("fs");
    try { unlinkSync(tgzPath); } catch { /* ignore */ }

    if (!existsSync(binPath)) {
      throw new Error("Failed to extract cloudflared binary");
    }

    chmodSync(binPath, 0o755);
  } else {
    await downloadFile(url, binPath);

    if (platform() !== "win32") {
      chmodSync(binPath, 0o755);
    }
  }

  return binPath;
}

let tunnelProcess: ChildProcess | null = null;

export async function startCloudflareTunnel(port: number): Promise<string> {
  const binPath = await ensureCloudflared();

  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    tunnelProcess = proc;

    let resolved = false;
    const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Tunnel startup timed out after 30s. Is your network connected?"));
      }
    }, 30000);

    const handleData = (data: Buffer) => {
      const line = data.toString();

      if (!resolved) {
        const match = line.match(urlRegex);
        if (match) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(match[0]);
        }
      }
    };

    proc.stdout?.on("data", handleData);
    proc.stderr?.on("data", handleData);

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error(`Failed to start cloudflared: ${err.message}`));
      }
    });

    proc.on("exit", (code) => {
      tunnelProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error(`cloudflared exited with code ${code}`));
      }
    });
  });
}

// Cleanup on process exit
process.on("exit", () => {
  if (tunnelProcess) {
    tunnelProcess.kill();
  }
});

process.on("SIGINT", () => {
  if (tunnelProcess) {
    tunnelProcess.kill();
  }
});
