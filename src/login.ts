import { LoginOptions, AWSCredentials } from "./types.js";
import { getProfile, saveProfile } from "./config/profile-store.js";
import { requestDeviceCode, displayDeviceCodePrompt, pollDeviceToken } from "./auth/device-flow.js";
import { parseSAMLAssertionRoles, parseSAMLSessionDuration } from "./auth/saml-parser.js";
import { promptSelectRole } from "./ui/role-selector.js";
import { assumeRoleWithSAML } from "./aws/sts.js";
import { writeAwsCredentialsFile } from "./aws/credentials.js";
import picocolors from "picocolors";

/**
 * Perform full Microsoft Entra ID (Azure AD) to AWS authentication flow.
 */
export async function login(options: LoginOptions = {}): Promise<AWSCredentials> {
  const profileName = options.profile || "default";
  const savedProfile = getProfile(profileName);

  const tenantId = options.tenantId || savedProfile?.tenantId || process.env.AZURE_TENANT_ID;
  const appId = options.appId || savedProfile?.appId || process.env.AZURE_APP_ID;

  if (!tenantId || !appId) {
    throw new Error(
      `Missing tenantId or appId. Please run 'aws-entra-login configure --profile ${profileName}' or pass --tenant-id and --app-id flags.`
    );
  }

  // 1. Request Device Code from Microsoft Entra ID
  const deviceResponse = await requestDeviceCode(tenantId, appId);

  // 2. Display interactive terminal prompt & inline QR code
  if (!options.quiet) {
    await displayDeviceCodePrompt(deviceResponse);
  }

  // 3. Poll for tokens
  const tokenData = await pollDeviceToken(
    tenantId,
    appId,
    deviceResponse.device_code,
    deviceResponse.interval,
    deviceResponse.expires_in
  );

  const samlAssertion = tokenData.samlAssertion || tokenData.idToken;

  // 4. Parse SAML Roles
  const roles = parseSAMLAssertionRoles(samlAssertion);
  let selectedRole;

  if (roles.length > 0) {
    selectedRole = await promptSelectRole(
      roles,
      options.roleArn || savedProfile?.defaultRoleArn
    );
  } else if (options.roleArn && savedProfile?.principalArn) {
    selectedRole = {
      roleArn: options.roleArn,
      principalArn: savedProfile.principalArn,
      accountId: "unknown",
      roleName: options.roleArn,
    };
  } else {
    throw new Error("No IAM roles found in SAML assertion and no --role-arn specified.");
  }

  // 5. Determine Session Duration
  const samlDuration = parseSAMLSessionDuration(samlAssertion);
  const durationSeconds = options.duration || savedProfile?.durationSeconds || samlDuration || 3600;

  // 6. Call AWS STS AssumeRoleWithSAML
  const credentials = await assumeRoleWithSAML({
    samlAssertionBase64: samlAssertion,
    roleArn: selectedRole.roleArn,
    principalArn: selectedRole.principalArn,
    durationSeconds,
    region: options.region || savedProfile?.region,
  });

  // 7. Write to ~/.aws/credentials if requested
  if (options.writeCredentials !== false) {
    const awsProfileName = savedProfile?.awsProfile || profileName;
    const credPath = writeAwsCredentialsFile(awsProfileName, credentials);

    if (!options.quiet) {
      console.log(`\n${picocolors.bold(picocolors.green("✔ Successfully Authenticated with AWS!"))}`);
      console.log(`  ${picocolors.cyan("Role:")}        ${picocolors.bold(selectedRole.roleName)} (${selectedRole.roleArn})`);
      console.log(`  ${picocolors.cyan("Account:")}     ${credentials.accountId}`);
      console.log(`  ${picocolors.cyan("Expires:")}     ${credentials.expiration.toLocaleTimeString()} (${credentials.expiration.toLocaleDateString()})`);
      console.log(`  ${picocolors.cyan("Credentials:")} Saved to ${picocolors.bold(credPath)} [${awsProfileName}]\n`);
    }
  }

  // Update saved profile with chosen role
  if (savedProfile) {
    savedProfile.defaultRoleArn = selectedRole.roleArn;
    savedProfile.principalArn = selectedRole.principalArn;
    saveProfile(savedProfile);
  }

  return credentials;
}
