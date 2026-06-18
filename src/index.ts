#!/usr/bin/env node

import { Command } from "commander";
import { startServer } from "./server.js";
import { startTunnel } from "./tunnel.js";
import {
  getConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  listConfig,
  isValidKey,
  isValidProvider,
  getValidKeys,
} from "./config.js";
import type { Provider } from "./config.js";
import chalk from "chalk";
import { resolve } from "path";
import { existsSync, statSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("folderex")
  .description(
    "Share any local folder via a public HTTPS URL with basic auth protection"
  )
  .version(pkg.version);

// ── Main command: serve ──────────────────────────────────────────────

program
  .argument("[folder]", "Folder to share", ".")
  .option("-u, --user <username>", "Username for basic auth")
  .option("-p, --pass <password>", "Password for basic auth")
  .option("-r, --provider <name>", "Tunnel provider: cloudflare | loophole | zrok | expose | packetriot")
  .option("-s, --subdomain <name>", "Custom subdomain (loophole / zrok) or GitHub username (expose)")
  .option("--sshkey <path>", "SSH private key for expose.sh (name or full path)")
  .option("--port <port>", "Local port (default: random available)")
  .option("--no-tunnel", "Disable tunnel, local server only")
  .action(async (folder: string, options: Record<string, unknown>) => {
    const config = getConfig();

    // Resolve with config fallback
    const user = (options.user as string) || config.user;
    const pass = (options.pass as string) || config.pass;
    const providerRaw =
      (options.provider as string) || config.provider || "cloudflare";
    const subdomain = (options.subdomain as string) || config.subdomain;
    const sshkey = (options.sshkey as string) || config.sshkey;
    const port = options.port ? parseInt(options.port as string, 10) : 0;
    const useTunnel = options.tunnel !== false;

    // Validate required fields
    if (!user || !pass) {
      console.error(
        chalk.red(
          "\n  Error: user and password are required.\n" +
            "  Provide them via -u/-p flags or save them with: folderex config set user <value>\n"
        )
      );
      process.exit(1);
    }

    // Validate provider
    if (!isValidProvider(providerRaw)) {
      console.error(
        chalk.red(
          `\n  Error: invalid provider "${providerRaw}". Use "cloudflare", "loophole", "zrok", "expose", or "packetriot".\n`
        )
      );
      process.exit(1);
    }

    const provider = providerRaw as Provider;
    const root = resolve(folder);

    if (!existsSync(root)) {
      console.error(chalk.red(`\n  Error: folder "${root}" does not exist.\n`));
      process.exit(1);
    }

    if (!statSync(root).isDirectory()) {
      console.error(
        chalk.red(`\n  Error: "${root}" is not a directory.\n`)
      );
      process.exit(1);
    }

    console.log("");
    console.log(chalk.bold("  folderex"));
    console.log(chalk.dim(`  Sharing:  ${root}`));
    console.log(chalk.dim(`  Provider: ${provider}`));
    console.log("");

    try {
      const { url: localUrl, port: actualPort } = await startServer({
        root,
        user,
        pass,
        port,
      });

      console.log(
        chalk.green("  * ") + `Local server:  ${chalk.underline(localUrl)}`
      );

      if (useTunnel) {
        console.log(chalk.dim("  - Starting tunnel..."));

        const publicUrl = await startTunnel({
          port: actualPort,
          provider,
          subdomain,
          sshkey,
        });

        // Clear the "Starting tunnel..." line
        process.stdout.write("\x1B[1A\x1B[2K");

        console.log(
          chalk.green("  * ") +
            `Public URL:    ${chalk.bold.underline(publicUrl)}`
        );
      }

      console.log("");
      console.log(
        chalk.dim(`  Auth: ${user} / ${"*".repeat(pass.length)}`)
      );
      console.log(chalk.dim("  Press Ctrl+C to stop"));
      console.log("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\n  Error: ${message}\n`));
      process.exit(1);
    }
  });

// ── Subcommand: config ───────────────────────────────────────────────

const configCmd = program
  .command("config")
  .description("Manage folderex configuration");

// config set <key> <value>
configCmd
  .command("set")
  .description("Set a configuration value")
  .argument("<key>", "Configuration key")
  .argument("<value>", "Configuration value")
  .action((key: string, value: string) => {
    if (!isValidKey(key)) {
      console.error(
        chalk.red(
          `\n  Error: invalid key "${key}". Valid keys: ${getValidKeys().join(", ")}\n`
        )
      );
      process.exit(1);
    }

    if (key === "provider" && !isValidProvider(value)) {
      console.error(
        chalk.red(
          `\n  Error: invalid provider "${value}". Use "cloudflare", "loophole", "zrok", "expose", or "packetriot".\n`
        )
      );
      process.exit(1);
    }

    setConfigValue(key, value);
    console.log(chalk.green(`\n  ${key} = ${key === "pass" ? "********" : value}\n`));
  });

// config get <key>
configCmd
  .command("get")
  .description("Get a configuration value")
  .argument("<key>", "Configuration key")
  .action((key: string) => {
    const value = getConfigValue(key);
    if (value === undefined) {
      console.log(chalk.dim(`\n  ${key} is not set\n`));
    } else {
      console.log(`\n  ${key} = ${key === "pass" ? "********" : value}\n`);
    }
  });

// config list
configCmd
  .command("list")
  .description("List all configuration values")
  .action(() => {
    const entries = listConfig();
    if (entries.length === 0) {
      console.log(chalk.dim("\n  No configuration set.\n"));
      console.log(
        chalk.dim("  Use: folderex config set <key> <value>")
      );
      console.log(
        chalk.dim(`  Valid keys: ${getValidKeys().join(", ")}\n`)
      );
      return;
    }

    console.log("");
    const maxKeyLen = Math.max(...entries.map((e) => e.key.length));
    for (const { key, value } of entries) {
      const display = key === "pass" ? "********" : value;
      console.log(`  ${key.padEnd(maxKeyLen)}  ${display}`);
    }
    console.log("");
  });

// config delete <key>
configCmd
  .command("delete")
  .description("Delete a configuration value")
  .argument("<key>", "Configuration key")
  .action((key: string) => {
    if (deleteConfigValue(key)) {
      console.log(chalk.green(`\n  Deleted: ${key}\n`));
    } else {
      console.log(chalk.dim(`\n  ${key} was not set\n`));
    }
  });

// ── Graceful shutdown ────────────────────────────────────────────────

process.on("SIGINT", () => {
  console.log(chalk.dim("\n  Shutting down..."));
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

program.parse();
