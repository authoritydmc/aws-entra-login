import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from "@aws-sdk/client-sso-oidc";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import picocolors from "picocolors";
import { renderQR } from "qr-term";
import { SSOTokenCache } from "../types.js";

const SSO_CACHE_DIR = path.join(os.homedir(), ".aws-entra-login", "sso-cache");

function getCacheFilePath(startUrl: string): string {
  const hash = crypto.createHash("sha1").update(startUrl).digest("hex");
  return path.join(SSO_CACHE_DIR, `${hash}.json`);
}

export function loadCachedSSOToken(startUrl: string): SSOTokenCache | null {
  try {
    const file = getCacheFilePath(startUrl);
    if (!fs.existsSync(file)) return null;
    const data: SSOTokenCache = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (new Date(data.expiresAt).getTime() > Date.now() + 60 * 1000) {
      return data;
    }
  } catch {}
  return null;
}

export function saveCachedSSOToken(cache: SSOTokenCache): void {
  if (!fs.existsSync(SSO_CACHE_DIR)) {
    fs.mkdirSync(SSO_CACHE_DIR, { recursive: true, mode: 0o700 });
  }
  const file = getCacheFilePath(cache.startUrl);
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), { mode: 0o600 });
}

export interface RegisterClientResult {
  clientId: string;
  clientSecret: string;
  clientSecretExpiresAt: number;
}

/**
 * Registers an OIDC client with AWS IAM Identity Center (SSO).
 */
export async function registerOIDCClient(
  ssoRegion: string
): Promise<RegisterClientResult> {
  const client = new SSOOIDCClient({ region: ssoRegion });
  const res = await client.send(
    new RegisterClientCommand({
      clientName: "aws-entra-login-cli",
      clientType: "public",
    })
  );

  if (!res.clientId || !res.clientSecret) {
    throw new Error("Failed to register AWS SSO OIDC client.");
  }

  return {
    clientId: res.clientId,
    clientSecret: res.clientSecret,
    clientSecretExpiresAt: res.clientIdIssuedAt ? (res.clientIdIssuedAt + (res.clientSecretExpiresAt || 0)) : Date.now() + 86400 * 1000,
  };
}

export interface DeviceAuthResult {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

/**
 * Starts device authorization with AWS SSO OIDC.
 */
export async function startSSODeviceAuth(
  ssoRegion: string,
  startUrl: string,
  clientId: string,
  clientSecret: string
): Promise<DeviceAuthResult> {
  const client = new SSOOIDCClient({ region: ssoRegion });
  const res = await client.send(
    new StartDeviceAuthorizationCommand({
      clientId,
      clientSecret,
      startUrl,
    })
  );

  if (!res.deviceCode || !res.userCode || !res.verificationUri) {
    throw new Error("Failed to start AWS SSO device authorization.");
  }

  return {
    deviceCode: res.deviceCode,
    userCode: res.userCode,
    verificationUri: res.verificationUri,
    verificationUriComplete: res.verificationUriComplete,
    expiresIn: res.expiresIn || 600,
    interval: res.interval || 5,
  };
}

/**
 * Displays the device authorization prompt with interactive QR code.
 */
export async function displaySSODevicePrompt(auth: DeviceAuthResult): Promise<void> {
  console.log(`\n${picocolors.bold(picocolors.cyan("🔒 AWS IAM Identity Center (SSO) Authentication"))}\n`);
  console.log(`  1. Open the verification URL in your browser:`);
  console.log(`     ${picocolors.bold(picocolors.underline(auth.verificationUriComplete || auth.verificationUri))}`);
  console.log(`\n  2. Enter the user code:`);
  console.log(`     ${picocolors.bgCyan(picocolors.black(picocolors.bold(`  ${auth.userCode}  `)))}\n`);

  const urlForQR = auth.verificationUriComplete || auth.verificationUri;
  console.log(picocolors.dim("  Or scan QR code with your mobile device:"));
  renderQR(urlForQR);
  console.log(picocolors.dim(`\nWaiting for authorization in browser (timeout: ${Math.round(auth.expiresIn / 60)} mins)...\n`));
}

/**
 * Polls AWS SSO OIDC for the access token until approved or expired.
 */
export async function pollSSOToken(
  ssoRegion: string,
  startUrl: string,
  clientId: string,
  clientSecret: string,
  deviceCode: string,
  intervalSeconds: number = 5,
  expiresInSeconds: number = 600
): Promise<SSOTokenCache> {
  const client = new SSOOIDCClient({ region: ssoRegion });
  const startTime = Date.now();
  const maxTime = startTime + expiresInSeconds * 1000;
  let interval = intervalSeconds * 1000;

  while (Date.now() < maxTime) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    try {
      const res = await client.send(
        new CreateTokenCommand({
          clientId,
          clientSecret,
          grantType: "urn:ietf:params:oauth:grant-type:device_code",
          deviceCode,
        })
      );

      if (res.accessToken) {
        const expiresAt = new Date(Date.now() + (res.expiresIn || 28800) * 1000).toISOString();
        const tokenCache: SSOTokenCache = {
          accessToken: res.accessToken,
          expiresAt,
          region: ssoRegion,
          startUrl,
          clientId,
          clientSecret,
        };
        saveCachedSSOToken(tokenCache);
        return tokenCache;
      }
    } catch (err: any) {
      if (err.name === "AuthorizationPendingException") {
        // Continue polling
        continue;
      } else if (err.name === "SlowDownException") {
        interval += 5000;
        continue;
      } else if (err.name === "ExpiredTokenException") {
        throw new Error("AWS SSO Device authorization expired. Please try logging in again.");
      } else {
        throw err;
      }
    }
  }

  throw new Error("AWS SSO Device authorization timed out.");
}

/**
 * Obtains a valid AWS SSO Access Token (from cache or via interactive device authorization).
 */
export async function getSSOAccessToken(
  ssoRegion: string,
  startUrl: string,
  options: { quiet?: boolean; force?: boolean } = {}
): Promise<string> {
  if (!options.force) {
    const cached = loadCachedSSOToken(startUrl);
    if (cached) {
      return cached.accessToken;
    }
  }

  // 1. Register OIDC client
  const clientReg = await registerOIDCClient(ssoRegion);

  // 2. Start Device Authorization
  const deviceAuth = await startSSODeviceAuth(
    ssoRegion,
    startUrl,
    clientReg.clientId,
    clientReg.clientSecret
  );

  // 3. Display prompt
  if (!options.quiet) {
    await displaySSODevicePrompt(deviceAuth);
  }

  // 4. Poll for token
  const tokenCache = await pollSSOToken(
    ssoRegion,
    startUrl,
    clientReg.clientId,
    clientReg.clientSecret,
    deviceAuth.deviceCode,
    deviceAuth.interval,
    deviceAuth.expiresIn
  );

  return tokenCache.accessToken;
}
