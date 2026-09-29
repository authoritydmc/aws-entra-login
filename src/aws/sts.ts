import { STSClient, AssumeRoleWithSAMLCommand } from "@aws-sdk/client-sts";
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
