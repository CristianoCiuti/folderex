import { spawn, execSync, ChildProcess } from "child_process";
import { existsSync, mkdirSync, createWriteStream } from "fs";
import { join } from "path";
import { homedir, platform, arch } from "os";
import https from "https";
import { extractZip } from "./extract.js";

const PKTRIOT_DIR = join(homedir(), ".folderex", "bin");
const PKTRIOT_VERSION = "1.0.0";

function getPktriotInfo(): { url: string; filename: string } {
  const p = platform();
  const a = arch();

  if (p === "win32") {
    return {
      url: `https://download.packetriot.com//windows/pktriot-${PKTRIOT_VERSION}.win64.zip`,
      filename: "pktriot.exe",
    };
  }

  if (p === "darwin") {
    const archStr = a === "arm64" ? "arm64" : "intel";
    return {
      url: `https://download.packetriot.com//macos/pktriot-${PKTRIOT_VERSION}.macos.${archStr}.zip`,
      filename: "pktriot",
    };
  }

  // Linux
  let archStr = "amd64";
  if (a === "arm64") archStr = "arm64";
  else if (a === "arm") archStr = "arm32";

  return {
    url: `https://download.packetriot.com//linux/tarballs/pktriot-${PKTRIOT_VERSION}.${archStr}.tar.gz`,
    filename: "pktriot",
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

async function ensurePktriot(): Promise<string> {
  const { url, filename } = getPktriotInfo();
  const binPath = join(PKTRIOT_DIR, filename);

  if (existsSync(binPath)) {
    return binPath;
  }

  mkdirSync(PKTRIOT_DIR, { recursive: true });

  const isZip = url.endsWith(".zip");
  const archivePath = join(PKTRIOT_DIR, isZip ? "pktriot.zip" : "pktriot.tar.gz");

  await downloadFile(url, archivePath);

  if (isZip) {
    extractZip(archivePath, PKTRIOT_DIR);
  } else {
    const { extractTarGz } = await import("./extract.js");
    await extractTarGz(archivePath, PKTRIOT_DIR);
  }

  // Clean up archive
  try {
    const { unlinkSync } = await import("fs");
    unlinkSync(archivePath);
  } catch {
    /* ignore */
  }

  // Binary might be in a subfolder
  if (!existsSync(binPath)) {
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
          /* skip */
        }
      }
      return null;
    }

    const found = findBinary(PKTRIOT_DIR, filename);
    if (found && found !== binPath) {
      renameSync(found, binPath);
    }

    // Clean subfolders
    for (const entry of readdirSync(PKTRIOT_DIR)) {
      const full = join(PKTRIOT_DIR, entry);
      try {
        if (statSyncFs(full).isDirectory()) {
          rmSync(full, { recursive: true, force: true });
        }
      } catch {
        /* ignore */
      }
    }

    if (!existsSync(binPath)) {
      throw new Error(
        "Failed to extract pktriot binary. Download it manually from https://packetriot.com/downloads"
      );
    }
  }

  if (platform() !== "win32") {
    const { chmodSync } = await import("fs");
    chmodSync(binPath, 0o755);
  }

  return binPath;
}

function getHostname(binPath: string): string {
  try {
    const output = execSync(`"${binPath}" info`, {
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();

    const match = output.match(/Hostname:\s+(\S+)/);
    if (match) {
      return match[1];
    }
    throw new Error("Could not parse hostname from pktriot info");
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() || "";
    if (stderr.includes("configure") || stderr.includes("not configured")) {
      throw new Error(
        "Packetriot is not configured. Run:\n" +
          `  "${binPath}" configure`
      );
    }
    throw new Error(
      "Packetriot is not configured. Run:\n" +
        `  "${binPath}" configure\n` +
        "  Sign up free at https://packetriot.com/signup"
    );
  }
}

let tunnelProcess: ChildProcess | null = null;

export async function startPacketriotTunnel(port: number): Promise<string> {
  const binPath = await ensurePktriot();
  const hostname = getHostname(binPath);

  return new Promise((resolve, reject) => {
    const args = ["http", String(port)];

    const proc = spawn(binPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    tunnelProcess = proc;

    let resolved = false;
    let allOutput = "";

    // pktriot http starts immediately — give it a moment to connect then return the URL
    const startupTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(`https://${hostname}`);
      }
    }, 3000);

    proc.stdout?.on("data", (data: Buffer) => {
      allOutput += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      allOutput += data.toString();
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(startupTimer);
        if (err.message.includes("ENOENT")) {
          reject(
            new Error(
              "pktriot binary not found. Try running folderex again to trigger a fresh download."
            )
          );
        } else {
          reject(new Error(`Failed to start pktriot: ${err.message}`));
        }
      }
    });

    proc.on("exit", (code) => {
      tunnelProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(startupTimer);

        let message = `pktriot exited with code ${code}.`;
        const output = allOutput.trim();
        if (output.includes("configure")) {
          message +=
            "\n  Packetriot is not configured. Run:\n" +
            `  "${binPath}" configure`;
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
