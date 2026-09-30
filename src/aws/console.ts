import https from "node:https";
import { exec } from "node:child_process";
import type { AWSCredentials } from "../types.js";

export interface ConsoleUrlOptions {
  destination?: string;
  region?: string;
  durationSeconds?: number;
}

/**
 * Retrieves an AWS Management Console federation sign-in URL using STS session credentials.
 */
export async function getConsoleLoginUrl(
  creds: AWSCredentials,
  options: ConsoleUrlOptions = {}
): Promise<string> {
  const {
    destination = "https://console.aws.amazon.com/",
    region,
  } = options;

  const sessionData = JSON.stringify({
    sessionId: creds.accessKeyId,
    sessionKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  });

  const getSigninTokenUrl = `https://signin.aws.amazon.com/federation?Action=getSigninToken&SessionType=json&Session=${encodeURIComponent(
    sessionData
  )}`;

  const signinToken = await new Promise<string>((resolve, reject) => {
    https
      .get(getSigninTokenUrl, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              return reject(
                new Error(
                  `AWS Federation service returned HTTP ${res.statusCode}: ${data}`
                )
              );
            }
            const parsed = JSON.parse(data);
            if (parsed.SigninToken) {
              resolve(parsed.SigninToken);
            } else {
              reject(new Error("No SigninToken found in AWS Federation response."));
            }
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", (err) => reject(err));
  });

  const targetDestination = region
    ? `https://${region}.console.aws.amazon.com/console/home?region=${region}`
    : destination;

  const loginUrl = `https://signin.aws.amazon.com/federation?Action=login&Issuer=aws-entra-login&Destination=${encodeURIComponent(
    targetDestination
  )}&SigninToken=${encodeURIComponent(signinToken)}`;

  return loginUrl;
}

/**
 * Opens a URL in the user's default browser cross-platform.
 */
export function openBrowser(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd = "";

    if (platform === "darwin") {
      cmd = `open "${url}"`;
    } else if (platform === "win32") {
      cmd = `start "" "${url}"`;
    } else {
      cmd = `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || x-www-browser "${url}" 2>/dev/null`;
    }

    exec(cmd, (err) => {
      resolve(!err);
    });
  });
}
