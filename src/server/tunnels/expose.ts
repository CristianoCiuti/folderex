import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { join, isAbsolute } from "path";
import { homedir } from "os";

let tunnelProcess: ChildProcess | null = null;

/**
 * Start a tunnel via expose.sh using SSH.
 *
 * expose.sh requires:
 *  - SSH client installed (built-in on Windows 10+, macOS, Linux)
 *  - SSH keys added to your GitHub account
 *  - Star the repo https://github.com/gaetanlhf/EXPOSE
 *
 * The `sshkey` parameter specifies which SSH private key to use.
 * Can be a full path or just the key name (e.g. "id_personal" → ~/.ssh/id_personal).
 *
 * The `subdomain` parameter is the GitHub username for authentication.
 * expose.sh uses it to verify SSH keys and stargazer status.
 * URL will be: https://<subdomain>.expos.es
 */
export async function startExposeTunnel(
  port: number,
  subdomain?: string,
  sshkey?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!subdomain) {
      reject(
        new Error(
          "GitHub username required for expose.sh.\n" +
            '  Set it with: folderex config set subdomain <your-github-username>\n' +
            "  Or pass -s <username>"
        )
      );
      return;
    }

    const sshTarget = `${subdomain.toLowerCase()}@expose.sh`;

    const args = [
      "-tt",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=15",
      "-o",
      "ServerAliveCountMax=3",
    ];

    // Add SSH key if specified
    if (sshkey) {
      // Absolute path → use as-is; relative → resolve from ~/.ssh/
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

    // Match tunnel URL: https://<username>.expos.es (the actual tunnel domain)
    const urlRegex = /https:\/\/[a-zA-Z0-9][a-zA-Z0-9._-]+\.expos\.es/;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(
          new Error(
            "expose.sh tunnel startup timed out after 30s.\n" +
              (allOutput.trim() ? `  Output: ${allOutput.trim()}\n` : "") +
              "  Make sure you have:\n" +
              "  1. SSH keys added to your GitHub account\n" +
              "  2. Starred the repo: https://github.com/gaetanlhf/EXPOSE"
          )
        );
      }
    }, 30_000);

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
              "SSH client not found.\n" +
                "  Windows: enable OpenSSH in Settings > Optional Features\n" +
                "  macOS/Linux: install openssh-client"
            )
          );
        } else {
          reject(
            new Error(`Failed to start expose.sh tunnel: ${err.message}`)
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
        let message = `expose.sh exited with code ${code}.`;

        if (
          output.includes("Permission denied") ||
          output.includes("publickey")
        ) {
          message +=
            "\n  SSH authentication failed. Make sure you have:\n" +
            "  1. SSH keys added to your GitHub account\n" +
            "  2. Starred the repo: https://github.com/gaetanlhf/EXPOSE";
        } else if (
          output.includes("do not have access") ||
          output.includes("star")
        ) {
          message +=
            "\n  Access denied. You must star the EXPOSE repo on GitHub:\n" +
            "  https://github.com/gaetanlhf/EXPOSE";
        } else if (output.includes("Connection refused")) {
          message += "\n  expose.sh server is unreachable. Try again later.";
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
