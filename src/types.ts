export interface EntraProfile {
  name: string;
  tenantId: string;
  appId: string; // Client ID of Azure AD Enterprise App / App Registration
  defaultRoleArn?: string;
  principalArn?: string;
  durationSeconds?: number; // default 3600 (up to 43200)
  region?: string;
  awsProfile?: string; // name in ~/.aws/credentials
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
  tenantId?: string;
  appId?: string;
  roleArn?: string;
  duration?: number;
  region?: string;
  writeCredentials?: boolean;
  quiet?: boolean;
  headless?: boolean;
}
