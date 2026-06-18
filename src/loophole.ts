import { spawn, ChildProcess } from "child_process";
import { existsSync, mkdirSync, createWriteStream, chmodSync } from "fs";
import { join } from "path";
import { homedir, platform, arch } from "os";
import https from "https";
import { extractTarGz, extractZip } from "./extract.js";

const LOOPHOLE_DIR = join(homedir(), ".folderex", "bin");
const LOOPHOLE_VERSION = "1.0.0-beta.15";

function getLoopholeInfo(): { url: string; filename: string; archiveType: "tar.gz" | "zip" } {
  const p = platform();
  const a = arch();

  const base = `https://github.com/loophole/cli/releases/download/${LOOPHOLE_VERSION}`;

  if (p === "win32") {
    const archStr = a === "x64" ? "64bit" : "32bit";
    return {
      url: `${base}/loophole-cli_${LOOPHOLE_VERSION}_windows_${archStr}.zip`,
      filename: "loophole.exe",
      archiveType: "zip",
    };
  }

  if (p === "darwin") {
    const archStr = a === "arm64" ? "arm64" : "64bit";
    return {
      url: `${base}/loophole-cli_${LOOPHOLE_VERSION}_macos_${archStr}.tar.gz`,
      filename: "loophole",
      archiveType: "tar.gz",
    };
  }

  // Linux
  let archStr = "64bit";
  if (a === "arm64") archStr = "arm64";
  else if (a === "arm") archStr = "armv7";

  return {
    url: `${base}/loophole-cli_${LOOPHOLE_VERSION}_linux_${archStr}.tar.gz`,
    filename: "loophole",
    archiveType: "tar.gz",
  };
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

async function ensureLoophole(): Promise<string> {
  const { url, filename, archiveType } = getLoopholeInfo();
  const binPath = join(LOOPHOLE_DIR, filename);

  if (existsSync(binPath)) {
    return binPath;
  }

  mkdirSync(LOOPHOLE_DIR, { recursive: true });

  if (archiveType === "tar.gz") {
    const archivePath = join(LOOPHOLE_DIR, "loophole.tar.gz");
    await downloadFile(url, archivePath);
    await extractTarGz(archivePath, LOOPHOLE_DIR);

    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(archivePath);
    } catch { /* ignore */ }
  } else {
    // zip (Windows)
    const archivePath = join(LOOPHOLE_DIR, "loophole.zip");
    await downloadFile(url, archivePath);
    extractZip(archivePath, LOOPHOLE_DIR);

    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(archivePath);
    } catch { /* ignore */ }
  }

  if (!existsSync(binPath)) {
    // The archive extracts into a subfolder (e.g. loophole-cli_1.0.0-beta.15_windows_64bit/)
    // Search for the binary recursively and move it to the expected location
    const { readdirSync, statSync: statSyncFs, renameSync, rmSync } = await import("fs");

    function findBinary(dir: string, target: string): string | null {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        try {
          if (statSyncFs(full).isDirectory()) {
            const found = findBinary(full, target);
            if (found) return found;
          } else if (entry === target) {
            return full;
          }
        } catch { /* skip inaccessible entries */ }
      }
      return null;
    }

    const found = findBinary(LOOPHOLE_DIR, filename);

    if (found && found !== binPath) {
      renameSync(found, binPath);

      // Clean up the now-empty extracted subfolder
      for (const entry of readdirSync(LOOPHOLE_DIR)) {
        const full = join(LOOPHOLE_DIR, entry);
        try {
          if (statSyncFs(full).isDirectory()) {
            rmSync(full, { recursive: true, force: true });
          }
        } catch { /* ignore cleanup errors */ }
      }
    }

    if (!existsSync(binPath)) {
      throw new Error(
        "Failed to extract loophole binary. Download it manually from https://loophole.cloud/download"
      );
    }
  }

  if (platform() !== "win32") {
    chmodSync(binPath, 0o755);
  }

  return binPath;
}

let tunnelProcess: ChildProcess | null = null;

export async function startLoopholeTunnel(
  port: number,
  subdomain?: string
): Promise<string> {
  const binPath = await ensureLoophole();

  return new Promise((resolve, reject) => {
    const args = ["http", String(port)];

    if (subdomain) {
      args.push("--hostname", subdomain);
    }

    const proc = spawn(binPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: homedir(), USERPROFILE: homedir() },
    });

    tunnelProcess = proc;

    let resolved = false;
    let allOutput = "";
    const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.loophole\.site/;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(
          new Error(
            "Loophole tunnel startup timed out after 60s.\n" +
              (allOutput.trim() ? `  Output: ${allOutput.trim()}\n` : "") +
              "  Make sure you are logged in: loophole account login"
          )
        );
      }
    }, 60000);

    const handleData = (data: Buffer) => {
      const text = data.toString();
      allOutput += text;

      if (!resolved) {
        const match = text.match(urlRegex);
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
        if (err.message.includes("ENOENT")) {
          reject(
            new Error(
              "Loophole binary not found. Try running folderex again to trigger a fresh download."
            )
          );
        } else {
          reject(new Error(`Failed to start loophole: ${err.message}`));
        }
      }
    });

    proc.on("exit", (code) => {
      tunnelProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);

        let message = `Loophole exited with code ${code}.`;
        const output = allOutput.trim();

        if (output.includes("not logged in") || output.includes("login") || output.includes("unauthorized")) {
          message +=
            "\n  You need to login first. Run:\n" +
            `  ${binPath} account login`;
        } else if (output) {
          message += `\n  Output: ${output}`;
        }

        reject(new Error(message));
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
