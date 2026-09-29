import fs from "fs";
import path from "path";
import os from "os";
import { AWSCredentials, CredentialProcessOutput } from "../types.js";

/**
 * Format AWS credentials as standard AWS CLI v2 credential_process JSON.
 */
export function formatCredentialProcessJSON(creds: AWSCredentials): CredentialProcessOutput {
  return {
    Version: 1,
    AccessKeyId: creds.accessKeyId,
    SecretAccessKey: creds.secretAccessKey,
    SessionToken: creds.sessionToken,
    Expiration: creds.expiration.toISOString(),
  };
}

/**
 * Format AWS credentials as shell export statements.
 */
export function formatShellEnv(creds: AWSCredentials): string {
  return [
    `export AWS_ACCESS_KEY_ID="${creds.accessKeyId}"`,
    `export AWS_SECRET_ACCESS_KEY="${creds.secretAccessKey}"`,
    `export AWS_SESSION_TOKEN="${creds.sessionToken}"`,
    `export AWS_SECURITY_TOKEN="${creds.sessionToken}"`,
    `export AWS_CREDENTIAL_EXPIRATION="${creds.expiration.toISOString()}"`,
  ].join("\n");
}

/**
 * Write or update credentials in ~/.aws/credentials file.
 */
export function writeAwsCredentialsFile(
  profileName: string,
  creds: AWSCredentials,
  customPath?: string
): string {
  const credentialsPath = customPath || path.join(os.homedir(), ".aws", "credentials");
  const dir = path.dirname(credentialsPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  let content = "";
  if (fs.existsSync(credentialsPath)) {
    content = fs.readFileSync(credentialsPath, "utf-8");
  }

  const profileHeader = `[${profileName}]`;
  const block = [
    `[${profileName}]`,
    `aws_access_key_id = ${creds.accessKeyId}`,
    `aws_secret_access_key = ${creds.secretAccessKey}`,
    `aws_session_token = ${creds.sessionToken}`,
    `aws_security_token = ${creds.sessionToken}`,
    `aws_credential_expiration = ${creds.expiration.toISOString()}`,
    `x_principal_arn = ${creds.roleArn}`,
  ].join("\n");

  const regex = new RegExp(`\\[${profileName}\\][\\s\\S]*?(?=\\n\\[|$)`, "g");

  if (regex.test(content)) {
    content = content.replace(regex, block);
  } else {
    content = content.trim() ? `${content.trim()}\n\n${block}\n` : `${block}\n`;
  }

  fs.writeFileSync(credentialsPath, content, { mode: 0o600 });
  return credentialsPath;
}
