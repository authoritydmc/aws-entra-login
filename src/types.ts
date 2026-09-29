export type ProfileType = "entra" | "sso";

export interface EntraProfile {
  name: string;
  type?: ProfileType; // "entra" (default) or "sso"
  // Entra ID fields
  tenantId?: string;
  appId?: string; // Client ID of Azure AD Enterprise App / App Registration
  defaultRoleArn?: string;
  principalArn?: string;
  durationSeconds?: number; // default 3600 (up to 43200)
  // AWS SSO (IAM Identity Center) fields
  ssoStartUrl?: string; // e.g. https://my-org.awsapps.com/start
  ssoRegion?: string;   // e.g. us-east-1
  ssoAccountId?: string;// target AWS Account ID
  ssoRoleName?: string; // target SSO Role Name (e.g. AdministratorAccess)
  // Common fields
  region?: string;
  awsProfile?: string;  // name in ~/.aws/credentials
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message?: string;
}

export interface SAMLRolePair {
  roleArn: string;
  principalArn: string;
  accountId: string;
  roleName: string;
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
  roleArn: string;
  accountId: string;
}

export interface CredentialProcessOutput {
  Version: 1;
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken: string;
  Expiration: string;
}

export interface LoginOptions {
  profile?: string;
  sso?: boolean;
  // Entra ID options
  tenantId?: string;
  appId?: string;
  roleArn?: string;
  duration?: number;
  // SSO options
  ssoStartUrl?: string;
  ssoRegion?: string;
  ssoAccountId?: string;
  ssoRoleName?: string;
  // Common options
  region?: string;
  writeCredentials?: boolean;
  quiet?: boolean;
  headless?: boolean;
  force?: boolean;
}

export interface SSOAccount {
  accountId: string;
  accountName: string;
  emailAddress?: string;
}

export interface SSORole {
  roleName: string;
  accountId: string;
}

export interface SSOTokenCache {
  accessToken: string;
  expiresAt: string;
  region: string;
  startUrl: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretExpiresAt?: number;
}
