import { spawn, execSync, ChildProcess } from "child_process";
import { existsSync, mkdirSync, createWriteStream, chmodSync } from "fs";
import { join } from "path";
import { homedir, platform, arch } from "os";
import https from "https";
import { extractTarGz } from "./extract.js";

const ZROK_DIR = join(homedir(), ".folderex", "bin");
const ZROK_VERSION = "2.0.4";

function getZrokInfo(): { url: string; filename: string } {
  const p = platform();
  const a = arch();

  const base = `https://github.com/openziti/zrok/releases/download/v${ZROK_VERSION}`;

  if (p === "win32") {
    return {
      url: `${base}/zrok_${ZROK_VERSION}_windows_amd64.tar.gz`,
      filename: "zrok2.exe",
    };
  }

  if (p === "darwin") {
    const archStr = a === "arm64" ? "arm64" : "amd64";
    return {
      url: `${base}/zrok_${ZROK_VERSION}_darwin_${archStr}.tar.gz`,
      filename: "zrok2",
    };
  }

  // Linux
  let archStr = "amd64";
  if (a === "arm64") archStr = "arm64";
  else if (a === "arm") archStr = "armv7";

  return {
    url: `${base}/zrok_${ZROK_VERSION}_linux_${archStr}.tar.gz`,
    filename: "zrok2",
  };
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (url: string, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      https
        .get(url, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
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
        })
        .on("error", reject);
    };

    follow(url);
  });
}

async function ensureZrok(): Promise<string> {
  const { url, filename } = getZrokInfo();
  const binPath = join(ZROK_DIR, filename);

  if (existsSync(binPath)) {
    return binPath;
  }

  mkdirSync(ZROK_DIR, { recursive: true });

  const archivePath = join(ZROK_DIR, "zrok.tar.gz");
  await downloadFile(url, archivePath);

  await extractTarGz(archivePath, ZROK_DIR);

  // Clean up archive
  try {
    const { unlinkSync } = await import("fs");
    unlinkSync(archivePath);
  } catch {
    /* ignore */
  }

  if (!existsSync(binPath)) {
    // The archive might extract into a subfolder — search for the binary
    const { readdirSync, statSync: statSyncFs, renameSync, rmSync } =
      await import("fs");

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
        } catch {
          /* skip inaccessible entries */
        }
      }
      return null;
    }

    const found = findBinary(ZROK_DIR, filename);

    if (found && found !== binPath) {
      renameSync(found, binPath);

      // Clean up extracted subfolders
      for (const entry of readdirSync(ZROK_DIR)) {
        const full = join(ZROK_DIR, entry);
        try {
          if (statSyncFs(full).isDirectory()) {
            rmSync(full, { recursive: true, force: true });
          }
        } catch {
          /* ignore cleanup errors */
        }
      }
    }

    if (!existsSync(binPath)) {
      throw new Error(
        "Failed to extract zrok binary. Download it manually from https://zrok.io"
      );
    }
  }

  if (platform() !== "win32") {
    chmodSync(binPath, 0o755);
  }

  return binPath;
}

function isZrokEnabled(binPath: string): boolean {
  try {
    const output = execSync(`"${binPath}" status`, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: homedir(), USERPROFILE: homedir() },
    }).toString();
    // If status returns without error and contains environment info, it's enabled
    return !output.includes("not enabled") && !output.includes("enable");
  } catch {
    return false;
  }
}

let tunnelProcess: ChildProcess | null = null;

export async function startZrokTunnel(
  port: number,
  subdomain?: string
): Promise<string> {
  const binPath = await ensureZrok();

  // Check if zrok is enabled
  if (!isZrokEnabled(binPath)) {
    throw new Error(
      "zrok is not enabled. You need to:\n" +
        "  1. Sign up at https://myzrok.io\n" +
        "  2. Get your enable token from the dashboard\n" +
        `  3. Run: ${binPath} enable <your-token>`
    );
  }

  // Ensure the custom name exists (create if needed, ignore if already exists)
  if (subdomain) {
    try {
      execSync(`"${binPath}" create name ${subdomain}`, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, HOME: homedir(), USERPROFILE: homedir() },
      });
    } catch {
      // Name probably already exists — that's fine
    }
  }

  // Try to start the share, and if there's a stale conflict, clean it up and retry
  return attemptShare(binPath, port, subdomain, true);
}

function attemptShare(
  binPath: string,
  port: number,
  subdomain: string | undefined,
  canRetry: boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["share", "public", "--headless", "--force-local"];

    if (subdomain) {
      args.push("--name-selection", `public:${subdomain}`);
    }

    args.push(`http://localhost:${port}`);

    const proc = spawn(binPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: homedir(), USERPROFILE: homedir() },
    });

    tunnelProcess = proc;

    let resolved = false;
    let allOutput = "";
    // zrok headless outputs the URL without protocol, e.g. "testfolderex.shares.zrok.io"
    const urlRegex = /([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.zrok\.io)/;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(
          new Error(
            "zrok tunnel startup timed out after 60s.\n" +
              (allOutput.trim() ? `  Output: ${allOutput.trim()}\n` : "") +
              "  Make sure zrok is enabled: zrok2 status"
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
          resolve(`https://${match[1]}`);
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
              "zrok binary not found. Try running folderex again to trigger a fresh download."
            )
          );
        } else {
          reject(new Error(`Failed to start zrok: ${err.message}`));
        }
      }
    });

    proc.on("exit", (code) => {
      tunnelProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);

        const output = allOutput.trim();

        // Stale share conflict: clean it up and retry
        if (
          canRetry &&
          subdomain &&
          output.includes("already in use")
        ) {
          cleanupStaleShare(binPath, subdomain)
            .then(() => attemptShare(binPath, port, subdomain, false))
            .then(resolve)
            .catch(reject);
          return;
        }

        let message = `zrok exited with code ${code}.`;
        if (
          output.includes("not enabled") ||
          output.includes("enable") ||
          output.includes("not found")
        ) {
          message +=
            "\n  You need to enable zrok first. Run:\n" +
            `  ${binPath} enable <your-token>\n` +
            "  Get your token at https://myzrok.io";
        } else if (output) {
          message += `\n  Output: ${output}`;
        }

        reject(new Error(message));
      }
    });
  });
}

/**
 * Find and delete the stale share that is blocking our name.
 */
async function cleanupStaleShare(
  binPath: string,
  subdomain: string
): Promise<void> {
  try {
    // List shares and find the one using our name
    const output = execSync(`"${binPath}" list shares`, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: homedir(), USERPROFILE: homedir() },
    }).toString();

    // Find the share token for our subdomain (line contains "subdomain.shares.zrok.io")
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.includes(`${subdomain}.shares.zrok.io`)) {
        // Extract share token (first column, format: │ <token> │ ...)
        const match = line.match(/│\s*([a-zA-Z0-9]+)\s*│/);
        if (match) {
          execSync(`"${binPath}" delete share ${match[1]}`, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, HOME: homedir(), USERPROFILE: homedir() },
          });
          return;
        }
      }
    }
  } catch {
    // If we can't clean up, the retry will fail and show the error
  }
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
