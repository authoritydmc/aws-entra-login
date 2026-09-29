import { STSClient, AssumeRoleWithSAMLCommand, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { AWSCredentials, SAMLRolePair } from "../types.js";

export interface AssumeRoleOptions {
  samlAssertionBase64: string;
  roleArn: string;
  principalArn: string;
  durationSeconds?: number;
  region?: string;
}

/**
 * Exchange SAML 2.0 Assertion with AWS STS for temporary credentials.
 */
export async function assumeRoleWithSAML(options: AssumeRoleOptions): Promise<AWSCredentials> {
  const client = new STSClient({
    region: options.region || process.env.AWS_REGION || "us-east-1",
  });

  const command = new AssumeRoleWithSAMLCommand({
    RoleArn: options.roleArn,
    PrincipalArn: options.principalArn,
    SAMLAssertion: options.samlAssertionBase64,
    DurationSeconds: options.durationSeconds || 3600,
  });

  const res = await client.send(command);

  if (!res.Credentials || !res.Credentials.AccessKeyId || !res.Credentials.SecretAccessKey) {
    throw new Error("AWS STS AssumeRoleWithSAML returned empty credentials");
  }

  const accountIdMatch = options.roleArn.match(/arn:aws:iam::(\d+):role\//);
  const accountId = accountIdMatch ? accountIdMatch[1] : "unknown";

  return {
    accessKeyId: res.Credentials.AccessKeyId,
    secretAccessKey: res.Credentials.SecretAccessKey,
    sessionToken: res.Credentials.SessionToken || "",
    expiration: res.Credentials.Expiration || new Date(Date.now() + 3600 * 1000),
    roleArn: options.roleArn,
    accountId,
  };
}

export interface AssumeChainedRoleOptions {
  baseCredentials: AWSCredentials;
  targetRoleArn: string;
  roleSessionName?: string;
  externalId?: string;
  durationSeconds?: number;
  region?: string;
}

/**
 * Assume a secondary destination IAM Role using base credentials (Role Chaining / Cross-Account Role Switch).
 */
export async function assumeChainedRole(options: AssumeChainedRoleOptions): Promise<AWSCredentials> {
  const client = new STSClient({
    region: options.region || process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: options.baseCredentials.accessKeyId,
      secretAccessKey: options.baseCredentials.secretAccessKey,
      sessionToken: options.baseCredentials.sessionToken,
    },
  });

  const sessionName =
    options.roleSessionName ||
    `aws-entra-login-${Math.floor(Date.now() / 1000)}`;

  const command = new AssumeRoleCommand({
    RoleArn: options.targetRoleArn,
    RoleSessionName: sessionName,
    ExternalId: options.externalId,
    DurationSeconds: options.durationSeconds || 3600,
  });

  const res = await client.send(command);

  if (!res.Credentials || !res.Credentials.AccessKeyId || !res.Credentials.SecretAccessKey) {
    throw new Error(`AWS STS AssumeRole for '${options.targetRoleArn}' returned empty credentials`);
  }

  const accountIdMatch = options.targetRoleArn.match(/arn:aws:iam::(\d+):role\//);
  const accountId = accountIdMatch ? accountIdMatch[1] : "unknown";

  return {
    accessKeyId: res.Credentials.AccessKeyId,
    secretAccessKey: res.Credentials.SecretAccessKey,
    sessionToken: res.Credentials.SessionToken || "",
    expiration: res.Credentials.Expiration || new Date(Date.now() + 3600 * 1000),
    roleArn: options.targetRoleArn,
    accountId,
  };
}
