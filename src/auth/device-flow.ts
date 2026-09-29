import { DeviceCodeResponse } from "../types.js";
import { renderQR } from "qr-term";
import picocolors from "picocolors";

const DEFAULT_SCOPE = "openid profile email https://graph.microsoft.com/.default";

/**
 * Request a Device Authorization Code from Microsoft Entra ID.
 */
export async function requestDeviceCode(
  tenantId: string,
  appId: string,
  scope: string = DEFAULT_SCOPE
): Promise<DeviceCodeResponse> {
  const endpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`;

  const params = new URLSearchParams();
  params.append("client_id", appId);
  params.append("scope", scope);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft Entra ID Device Code Request failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as DeviceCodeResponse;
}

/**
 * Display interactive device authorization banner with big code and inline QR code.
 */
export async function displayDeviceCodePrompt(deviceResponse: DeviceCodeResponse): Promise<void> {
  console.log(`\n${picocolors.bold(picocolors.cyan("🔑 Microsoft Entra ID (Azure AD) Authentication"))}`);
  console.log(`  To sign in, use a web browser to open the page ${picocolors.underline(picocolors.cyan(deviceResponse.verification_uri))}`);
  console.log(`  and enter the code: ${picocolors.bgCyan(picocolors.black(picocolors.bold(` ${deviceResponse.user_code} `)))}\n`);
  console.log(`  ${picocolors.green("Or scan this QR Code on your mobile phone:")}\n`);

  // Direct inline QR rendering via qr-term!
  await renderQR(deviceResponse.verification_uri, {
    small: true,
    protocol: "halfblock",
  });

  console.log(`\n  ${picocolors.dim(`Waiting for authorization (polling every ${deviceResponse.interval || 5}s)...`)}`);
}

/**
 * Poll Microsoft Entra ID token endpoint until user approves or code expires.
 */
export async function pollDeviceToken(
  tenantId: string,
  appId: string,
  deviceCode: string,
  intervalSeconds: number = 5,
  expiresInSeconds: number = 900
): Promise<{ accessToken: string; idToken: string; samlAssertion?: string }> {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const startTime = Date.now();
  const maxTime = startTime + expiresInSeconds * 1000;
  const pollInterval = Math.max(2, intervalSeconds) * 1000;

  while (Date.now() < maxTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const params = new URLSearchParams();
    params.append("client_id", appId);
    params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");
    params.append("device_code", deviceCode);

    const res = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data: any = await res.json();

    if (res.ok && data.access_token) {
      return {
        accessToken: data.access_token,
        idToken: data.id_token,
        samlAssertion: data.saml_assertion || data.id_token,
      };
    }

    if (data.error === "authorization_pending") {
      // User hasn't finished signing in yet, keep polling
      continue;
    }

    if (data.error === "slow_down") {
      // Server requests slower polling
      await new Promise((resolve) => setTimeout(resolve, pollInterval * 2));
      continue;
    }

    if (data.error === "expired_token" || data.error === "code_expired") {
      throw new Error("Device authorization code expired. Please try logging in again.");
    }

    if (data.error === "authorization_declined") {
      throw new Error("Sign-in request was declined by the user.");
    }

    throw new Error(`Microsoft Entra ID token error: ${data.error_description || data.error}`);
  }

  throw new Error("Device authorization timed out.");
}
