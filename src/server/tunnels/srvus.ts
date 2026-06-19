import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join, isAbsolute } from "path";
import { homedir } from "os";

let tunnelProcess: ChildProcess | null = null;

/**
 * Start a tunnel via srv.us using SSH.
 *
 * srv.us requires:
 *  - SSH client installed (built-in on Windows 10+, macOS, Linux)
 *  - An SSH key (ed25519 recommended)
 *
 * No account needed. URLs are derived from your SSH key.
 * If your SSH key is on GitHub, you also get: https://<github-user>.gh.srv.us
 *
 * The `subdomain` parameter is used as the SSH username (GitHub login)
 * to get a vanity URL like https://<subdomain>.gh.srv.us
 *
 * The `sshkey` parameter specifies which SSH private key to use.
 * Can be a full path or just the key name (e.g. "id_personal" -> ~/.ssh/id_personal).
 */
export async function startSrvusTunnel(
  port: number,
  subdomain?: string,
  sshkey?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const sshTarget = subdomain
      ? `${subdomain}@srv.us`
      : "srv.us";

    const args = [
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
    ];

    // Add SSH key if specified
    if (sshkey) {
      const keyPath = isAbsolute(sshkey)
        ? sshkey
        : join(homedir(), ".ssh", sshkey);
      if (!existsSync(keyPath)) {
        reject(new Error(`SSH key not found: ${keyPath}`));
        return;
      }
      args.push("-i", keyPath, "-o", "IdentitiesOnly=yes");
    }

    args.push("-R", `1:localhost:${port}`, sshTarget);

    const proc = spawn("ssh", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    tunnelProcess = proc;

    let resolved = false;
    let allOutput = "";

    // srv.us outputs lines like:
    //   1: https://abc123.srv.us/, https://user.gh.srv.us/
    // Prefer the .gh.srv.us vanity URL if available, otherwise use the hash URL
    const ghUrlRegex = /https:\/\/[a-zA-Z0-9][a-zA-Z0-9._-]+\.gh\.srv\.us\//;
    const hashUrlRegex = /https:\/\/[a-z0-9]+\.srv\.us\//;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(
          new Error(
            "srv.us tunnel startup timed out after 30s.\n" +
              (allOutput.trim() ? `  Output: ${allOutput.trim()}\n` : "") +
              "  Make sure you have an SSH key (ssh-keygen -t ed25519)"
          )
        );
      }
    }, 30_000);

    const handleData = (data: Buffer) => {
      const text = data.toString();
      allOutput += text;

      if (!resolved) {
        // Try vanity URL first
        const ghMatch = text.match(ghUrlRegex);
        if (ghMatch) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(ghMatch[0].replace(/\/$/, ""));
          return;
        }
        // Fallback to hash URL
        const hashMatch = text.match(hashUrlRegex);
        if (hashMatch) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(hashMatch[0].replace(/\/$/, ""));
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
              "SSH client not found.\n" +
                "  Windows: enable OpenSSH in Settings > Optional Features\n" +
                "  macOS/Linux: install openssh-client"
            )
          );
        } else {
          reject(
            new Error(`Failed to start srv.us tunnel: ${err.message}`)
          );
        }
      }
    });

    proc.on("exit", (code) => {
      tunnelProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);

        const output = allOutput.trim();
        let message = `srv.us exited with code ${code}.`;

        if (
          output.includes("Permission denied") ||
          output.includes("publickey")
        ) {
          message +=
            "\n  SSH key required. Generate one with:\n" +
            "  ssh-keygen -t ed25519";
        } else if (output.includes("Connection refused")) {
          message += "\n  srv.us server is unreachable. Try again later.";
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
