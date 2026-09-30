import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import picocolors from "picocolors";
import { listProfiles, getProfile } from "./config/profile-store.js";

interface DiagnosticResult {
  title: string;
  status: "ok" | "warn" | "error";
  message: string;
  fix?: string;
}

function checkEndpoint(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 4000 }, (res) => {
      res.resume();
      resolve({ ok: true, latencyMs: Date.now() - start });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, error: "Connection timed out" });
    });

    req.on("error", (err) => {
      resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
    });
  });
}

function checkSystemClock(): Promise<DiagnosticResult> {
  return new Promise((resolve) => {
    https
      .get("https://sts.amazonaws.com", (res) => {
        const serverDateHeader = res.headers.date;
        if (serverDateHeader) {
          const serverTime = new Date(serverDateHeader).getTime();
          const localTime = Date.now();
          const skewSeconds = Math.abs(localTime - serverTime) / 1000;

          if (skewSeconds > 300) {
            resolve({
              title: "System Clock Sync",
              status: "error",
              message: `System clock is skewed by ${Math.round(skewSeconds)}s from AWS servers.`,
              fix: "Synchronize your system clock using NTP (e.g. 'sudo systemctl restart systemd-timesyncd').",
            });
            return;
          }

          resolve({
            title: "System Clock Sync",
            status: "ok",
            message: `Clock is synchronized (skew: ${skewSeconds.toFixed(1)}s).`,
          });
        } else {
          resolve({
            title: "System Clock Sync",
            status: "ok",
            message: "Unable to extract AWS Date header, skipping skew check.",
          });
        }
      })
      .on("error", () => {
        resolve({
          title: "System Clock Sync",
          status: "warn",
          message: "Could not connect to AWS STS to verify clock skew.",
        });
      });
  });
}

export async function runDoctor(targetProfile?: string): Promise<void> {
  console.log(`\n${picocolors.bold("🩺 AWS Entra Login — Diagnostics & Doctor")}`);
  console.log("─".repeat(60));

  const results: DiagnosticResult[] = [];

  // 1. Check Node.js runtime
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor >= 18) {
    results.push({
      title: "Node.js Runtime",
      status: "ok",
      message: `Node.js v${process.versions.node} (>= 18 supported)`,
    });
  } else {
    results.push({
      title: "Node.js Runtime",
      status: "error",
      message: `Node.js v${process.versions.node} is outdated.`,
      fix: "Upgrade to Node.js 18 or 20 LTS.",
    });
  }

  // 2. Check ~/.aws directory permissions
  const awsDir = path.join(os.homedir(), ".aws");
  if (!fs.existsSync(awsDir)) {
    try {
      fs.mkdirSync(awsDir, { recursive: true, mode: 0o700 });
      results.push({
        title: "AWS Credentials Directory",
        status: "ok",
        message: "Created ~/.aws directory with 0700 permissions.",
      });
    } catch (err: any) {
      results.push({
        title: "AWS Credentials Directory",
        status: "error",
        message: `Cannot write to ${awsDir}: ${err.message}`,
        fix: "Check permissions for ~/.aws.",
      });
    }
  } else {
    results.push({
      title: "AWS Credentials Directory",
      status: "ok",
      message: `${awsDir} exists and is accessible.`,
    });
  }

  // 3. Test Microsoft Entra ID Endpoint Connectivity
  const entraRes = await checkEndpoint("https://login.microsoftonline.com");
  if (entraRes.ok) {
    results.push({
      title: "Microsoft Entra ID Connectivity",
      status: "ok",
      message: `login.microsoftonline.com reachable (${entraRes.latencyMs}ms)`,
    });
  } else {
    results.push({
      title: "Microsoft Entra ID Connectivity",
      status: "error",
      message: `Failed to reach login.microsoftonline.com: ${entraRes.error}`,
      fix: "Check your internet connection or corporate firewall/VPN proxy settings.",
    });
  }

  // 4. Test AWS STS Connectivity
  const stsRes = await checkEndpoint("https://sts.amazonaws.com");
  if (stsRes.ok) {
    results.push({
      title: "AWS STS Global Endpoint",
      status: "ok",
      message: `sts.amazonaws.com reachable (${stsRes.latencyMs}ms)`,
    });
  } else {
    results.push({
      title: "AWS STS Global Endpoint",
      status: "error",
      message: `Failed to reach sts.amazonaws.com: ${stsRes.error}`,
      fix: "Check AWS network routing or corporate firewall proxy settings.",
    });
  }

  // 5. Check System Clock Skew
  const clockRes = await checkSystemClock();
  results.push(clockRes);

  // 6. Check Profiles
  const profiles = listProfiles();
  if (profiles.length === 0) {
    results.push({
      title: "Profile Configurations",
      status: "warn",
      message: "No profiles configured in ~/.aws-entra-login/config.json.",
      fix: "Run 'aws-entra-login configure' or 'aws-entra-login import-aws' to configure a profile.",
    });
  } else {
    const target = targetProfile ? getProfile(targetProfile) : profiles[0];
    if (targetProfile && !target) {
      results.push({
        title: `Profile '${targetProfile}'`,
        status: "error",
        message: `Profile '${targetProfile}' does not exist.`,
        fix: `Run 'aws-entra-login configure -p ${targetProfile}'.`,
      });
    } else if (target) {
      if (target.type === "sso" || target.ssoStartUrl) {
        if (!target.ssoStartUrl || !target.ssoStartUrl.startsWith("https://")) {
          results.push({
            title: `Profile '${target.name}' SSO Start URL`,
            status: "error",
            message: `SSO Start URL '${target.ssoStartUrl || ""}' is invalid. Must start with https://`,
            fix: "Update profile with a valid AWS SSO start URL (e.g. https://my-org.awsapps.com/start).",
          });
        } else {
          results.push({
            title: `Profile '${target.name}' Configuration`,
            status: "ok",
            message: `Valid AWS SSO profile (${target.ssoStartUrl})`,
          });
        }
      } else {
        const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const tenantId = target.tenantId || "";
        const appId = target.appId || "";

        if (!validUuid.test(tenantId) && tenantId !== "common") {
          results.push({
            title: `Profile '${target.name}' Tenant ID`,
            status: "warn",
            message: `Tenant ID '${tenantId}' does not match standard UUID format.`,
            fix: "Verify Microsoft Entra Directory ID from Azure portal.",
          });
        }
        if (!validUuid.test(appId)) {
          results.push({
            title: `Profile '${target.name}' App ID`,
            status: "warn",
            message: `App ID '${appId}' does not match standard UUID format.`,
            fix: "Verify Azure Enterprise App / Client ID.",
          });
        }
      }
    }
  }

  // Print results
  for (const r of results) {
    const icon =
      r.status === "ok"
        ? picocolors.green("✔")
        : r.status === "warn"
        ? picocolors.yellow("▲")
        : picocolors.red("✖");

    console.log(`${icon} ${picocolors.bold(r.title)}`);
    console.log(`  ${r.message}`);
    if (r.fix) {
      console.log(`  ${picocolors.cyan("Tip:")} ${r.fix}`);
    }
    console.log("");
  }

  const errors = results.filter((r) => r.status === "error").length;
  const warnings = results.filter((r) => r.status === "warn").length;

  console.log("─".repeat(60));
  if (errors === 0 && warnings === 0) {
    console.log(picocolors.green(picocolors.bold("✨ All systems operational! No issues detected.\n")));
  } else if (errors === 0) {
    console.log(picocolors.yellow(picocolors.bold(`⚠️  ${warnings} warning(s) detected. Setup is functional.\n`)));
  } else {
    console.log(picocolors.red(picocolors.bold(`❌ ${errors} error(s) found. Please resolve the issues above.\n`)));
  }
}
