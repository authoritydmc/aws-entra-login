import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import picocolors from "picocolors";
import { listProfiles } from "./config/profile-store.js";
import { loadCachedSSOToken } from "./auth/sso-flow.js";

export function formatTimeRemaining(expirationDate: Date): string {
  const diffMs = expirationDate.getTime() - Date.now();
  if (diffMs <= 0) {
    return picocolors.red("Expired");
  }

  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  if (hours > 0) {
    return picocolors.green(`${hours}h ${minutes}m remaining`);
  }
  if (minutes > 10) {
    return picocolors.yellow(`${minutes}m remaining`);
  }
  return picocolors.red(`${minutes}m remaining (expiring soon)`);
}

/**
 * Checks cached AWS credentials in ~/.aws/credentials or session state
 */
export function getAwsProfileCredentialsStatus(profileName: string): {
  exists: boolean;
  awsProfile: string;
} {
  const credentialsPath = path.join(os.homedir(), ".aws", "credentials");
  if (!fs.existsSync(credentialsPath)) {
    return { exists: false, awsProfile: profileName };
  }

  const content = fs.readFileSync(credentialsPath, "utf-8");
  const sectionHeader = `[${profileName}]`;
  const exists = content.includes(sectionHeader);

  return { exists, awsProfile: profileName };
}

export function showProfileStatus(targetProfile?: string): void {
  const profiles = listProfiles();

  if (profiles.length === 0) {
    console.log(picocolors.yellow("No profiles configured yet. Run 'aws-entra-login configure' to create one."));
    return;
  }

  const filtered = targetProfile
    ? profiles.filter((p) => p.name.toLowerCase() === targetProfile.toLowerCase())
    : profiles;

  if (targetProfile && filtered.length === 0) {
    console.log(picocolors.red(`Profile '${targetProfile}' not found.`));
    return;
  }

  console.log(`\n${picocolors.bold("📊 AWS Entra Login — Profile Status Dashboard")}`);
  console.log("─".repeat(60));

  for (const p of filtered) {
    const isSSO = p.type === "sso" || Boolean(p.ssoStartUrl);
    const awsProfile = p.awsProfile || p.name;
    const credStatus = getAwsProfileCredentialsStatus(awsProfile);

    console.log(`\n▶ ${picocolors.bold(picocolors.cyan(p.name))} ${picocolors.magenta(`[${isSSO ? "AWS SSO" : "Entra ID"}]`)}`);
    console.log(`  • Destination AWS Profile: ${picocolors.yellow(awsProfile)} (${credStatus.exists ? picocolors.green("configured in ~/.aws/credentials") : picocolors.dim("not in credentials file")})`);

    if (isSSO && p.ssoStartUrl) {
      const cachedToken = loadCachedSSOToken(p.ssoStartUrl);

      if (cachedToken) {
        const tokenExpires = new Date(cachedToken.expiresAt);
        console.log(`  • SSO Access Token:        ${formatTimeRemaining(tokenExpires)} (expires at ${tokenExpires.toLocaleTimeString()})`);
      } else {
        console.log(`  • SSO Access Token:        ${picocolors.dim("No cached session (login required)")}`);
      }

      if (p.ssoAccountId) {
        console.log(`  • Target Account ID:       ${p.ssoAccountId}`);
      }
      if (p.ssoRoleName) {
        console.log(`  • Target Role Name:        ${p.ssoRoleName}`);
      }
    } else {
      if (p.tenantId) console.log(`  • Tenant ID:               ${p.tenantId}`);
      if (p.appId) console.log(`  • App ID:                  ${p.appId}`);
      if (p.defaultRoleArn) {
        console.log(`  • Default IAM Role:        ${p.defaultRoleArn}`);
      }
    }

    if (p.targetRoleArn) {
      console.log(`  • Chained Target Role:     ${picocolors.cyan(p.targetRoleArn)}`);
    }
  }

  console.log("\n" + "─".repeat(60) + "\n");
}
