import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import picocolors from "picocolors";
import { saveProfile, listProfiles } from "./config/profile-store.js";
import type { ProfileConfig } from "./types.js";

/**
 * Parses ~/.aws/config to discover existing AWS SSO configurations.
 */
export function parseAwsConfigFile(configContent: string): ProfileConfig[] {
  const lines = configContent.split("\n");
  const ssoSessions: Record<string, { sso_start_url?: string; sso_region?: string }> = {};
  const profiles: Record<string, Partial<ProfileConfig>> = {};

  let currentSection = "";
  let currentSectionType: "profile" | "sso-session" | "" = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const sectionMatch = line.match(/^\[(.*)\]$/);
    if (sectionMatch) {
      const header = sectionMatch[1].trim();
      if (header.startsWith("sso-session ")) {
        currentSection = header.replace(/^sso-session\s+/, "").trim();
        currentSectionType = "sso-session";
        ssoSessions[currentSection] = {};
      } else if (header.startsWith("profile ")) {
        currentSection = header.replace(/^profile\s+/, "").trim();
        currentSectionType = "profile";
        profiles[currentSection] = { name: currentSection, type: "sso" };
      } else if (header === "default") {
        currentSection = "default";
        currentSectionType = "profile";
        profiles[currentSection] = { name: "default", type: "sso" };
      } else {
        currentSection = header;
        currentSectionType = "profile";
        profiles[currentSection] = { name: header, type: "sso" };
      }
      continue;
    }

    const kvMatch = line.match(/^([^=]+)=(.*)$/);
    if (!kvMatch || !currentSection) continue;

    const key = kvMatch[1].trim().toLowerCase();
    const val = kvMatch[2].trim();

    if (currentSectionType === "sso-session") {
      if (key === "sso_start_url") ssoSessions[currentSection].sso_start_url = val;
      if (key === "sso_region") ssoSessions[currentSection].sso_region = val;
    } else if (currentSectionType === "profile") {
      const prof = profiles[currentSection];
      if (prof) {
        if (key === "sso_start_url") prof.ssoStartUrl = val;
        if (key === "sso_region") prof.ssoRegion = val;
        if (key === "sso_account_id") prof.ssoAccountId = val;
        if (key === "sso_role_name") prof.ssoRoleName = val;
        if (key === "region") prof.region = val;
        if (key === "sso_session") (prof as any).ssoSession = val;
      }
    }
  }

  // Link sso_session properties to profiles
  const importedProfiles: ProfileConfig[] = [];

  for (const [name, prof] of Object.entries(profiles)) {
    const ssoSessionName = (prof as any).ssoSession;
    if (ssoSessionName && ssoSessions[ssoSessionName]) {
      if (!prof.ssoStartUrl) prof.ssoStartUrl = ssoSessions[ssoSessionName].sso_start_url;
      if (!prof.ssoRegion) prof.ssoRegion = ssoSessions[ssoSessionName].sso_region;
    }

    if (prof.ssoStartUrl) {
      importedProfiles.push({
        name: prof.name || name,
        type: "sso",
        ssoStartUrl: prof.ssoStartUrl,
        ssoRegion: prof.ssoRegion || "us-east-1",
        ssoAccountId: prof.ssoAccountId,
        ssoRoleName: prof.ssoRoleName,
        awsProfile: prof.name || name,
        region: prof.region || prof.ssoRegion || "us-east-1",
      });
    }
  }

  return importedProfiles;
}

export function importAwsProfiles(): { imported: number; profiles: ProfileConfig[] } {
  const configPath = path.join(os.homedir(), ".aws", "config");

  if (!fs.existsSync(configPath)) {
    throw new Error(`AWS configuration file not found at ${configPath}`);
  }

  const content = fs.readFileSync(configPath, "utf-8");
  const discovered = parseAwsConfigFile(content);

  if (discovered.length === 0) {
    return { imported: 0, profiles: [] };
  }

  for (const p of discovered) {
    saveProfile(p);
  }

  return { imported: discovered.length, profiles: discovered };
}
