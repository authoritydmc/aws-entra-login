import fs from "fs";
import path from "path";
import os from "os";
import { EntraProfile } from "../types.js";

const CONFIG_DIR = path.join(os.homedir(), ".aws-entra-login");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface ConfigStore {
  profiles: Record<string, EntraProfile>;
  defaultProfile?: string;
}

export function loadConfig(): ConfigStore {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { profiles: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return { profiles: {} };
  }
}

export function saveConfig(config: ConfigStore): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getProfile(name: string = "default"): EntraProfile | undefined {
  const config = loadConfig();
  return config.profiles[name];
}

export function saveProfile(profile: EntraProfile): void {
  const config = loadConfig();
  config.profiles[profile.name] = profile;
  if (!config.defaultProfile) {
    config.defaultProfile = profile.name;
  }
  saveConfig(config);
}

export function listProfiles(): EntraProfile[] {
  const config = loadConfig();
  return Object.values(config.profiles);
}
