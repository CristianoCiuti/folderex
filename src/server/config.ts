import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".folderex", "conf");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export type Provider = "cloudflare" | "loophole" | "zrok" | "expose" | "packetriot" | "srvus";

export interface FolderexConfig {
  user?: string;
  pass?: string;
  tunnel?: Provider;
  subdomain?: string;
  sshkey?: string;
  port?: string;
  [key: string]: string | undefined;
}

const VALID_KEYS = ["user", "pass", "tunnel", "subdomain", "sshkey", "port"] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

export function isValidKey(key: string): key is ConfigKey {
  return (VALID_KEYS as readonly string[]).includes(key);
}

export function isValidProvider(value: string): value is Provider {
  return ["cloudflare", "loophole", "zrok", "expose", "packetriot", "srvus"].includes(value);
}

export function getValidKeys(): readonly string[] {
  return VALID_KEYS;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfig(): FolderexConfig {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as FolderexConfig;
  } catch {
    return {};
  }
}

export function getConfigValue(key: string): string | undefined {
  const config = getConfig();
  return config[key];
}

export function setConfigValue(key: string, value: string): void {
  ensureConfigDir();
  const config = getConfig();
  config[key] = value;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function deleteConfigValue(key: string): boolean {
  const config = getConfig();
  if (!(key in config)) {
    return false;
  }
  delete config[key];
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return true;
}

export function listConfig(): Array<{ key: string; value: string }> {
  const config = getConfig();
  return Object.entries(config)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value: value as string }));
}
