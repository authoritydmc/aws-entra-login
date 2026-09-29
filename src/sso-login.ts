import { LoginOptions, AWSCredentials } from "./types.js";
import { getProfile, saveProfile } from "./config/profile-store.js";
import { getSSOAccessToken } from "./auth/sso-flow.js";
import { listSSOAccounts, listSSORoles, getSSORoleCredentials } from "./aws/sso.js";
import { promptSelectSSOAccount, promptSelectSSORole } from "./ui/sso-selector.js";
import { writeAwsCredentialsFile } from "./aws/credentials.js";
import picocolors from "picocolors";

/**
 * Performs full AWS IAM Identity Center (AWS SSO) authentication flow.
 */
export async function ssoLogin(options: LoginOptions = {}): Promise<AWSCredentials> {
  const profileName = options.profile || "default";
  const savedProfile = getProfile(profileName);

  const startUrl =
    options.ssoStartUrl ||
    savedProfile?.ssoStartUrl ||
    process.env.AWS_SSO_START_URL ||
    process.env.SSO_START_URL;

  const ssoRegion =
    options.ssoRegion ||
    savedProfile?.ssoRegion ||
    options.region ||
    savedProfile?.region ||
    process.env.AWS_SSO_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";

  if (!startUrl) {
    throw new Error(
      `Missing AWS SSO Start URL. Please run 'aws-entra-login sso configure --profile ${profileName}' or pass --sso-start-url flag.`
    );
  }

  // 1. Obtain OIDC Access Token (cached or interactive device flow)
  const accessToken = await getSSOAccessToken(ssoRegion, startUrl, {
    quiet: options.quiet,
    force: options.force,
  });

  // 2. Discover Accounts
  const accounts = await listSSOAccounts(ssoRegion, accessToken);
  const targetAccountId = options.ssoAccountId || savedProfile?.ssoAccountId;
  const selectedAccount = await promptSelectSSOAccount(accounts, targetAccountId);

  // 3. Discover Roles in Account
  const roles = await listSSORoles(ssoRegion, accessToken, selectedAccount.accountId);
  const targetRoleName = options.ssoRoleName || savedProfile?.ssoRoleName;
  const selectedRole = await promptSelectSSORole(roles, targetRoleName);

  // 4. Retrieve temporary STS Credentials
  const credentials = await getSSORoleCredentials({
    ssoRegion,
    accessToken,
    accountId: selectedAccount.accountId,
    roleName: selectedRole.roleName,
  });

  // 5. Write to ~/.aws/credentials if requested
  if (options.writeCredentials !== false) {
    const awsProfileName = savedProfile?.awsProfile || profileName;
    const credPath = writeAwsCredentialsFile(awsProfileName, credentials);

    if (!options.quiet) {
      console.log(`\n${picocolors.bold(picocolors.green("✔ Successfully Authenticated with AWS SSO!"))}`);
      console.log(`  ${picocolors.cyan("Account:")}     ${picocolors.bold(selectedAccount.accountName)} (${selectedAccount.accountId})`);
      console.log(`  ${picocolors.cyan("Role:")}        ${picocolors.bold(selectedRole.roleName)}`);
      console.log(`  ${picocolors.cyan("Expires:")}     ${credentials.expiration.toLocaleTimeString()} (${credentials.expiration.toLocaleDateString()})`);
      console.log(`  ${picocolors.cyan("Credentials:")} Saved to ${picocolors.bold(credPath)} [${awsProfileName}]\n`);
    }
  }

  // 6. Persist selected account & role to saved profile
  if (savedProfile) {
    savedProfile.type = "sso";
    savedProfile.ssoStartUrl = startUrl;
    savedProfile.ssoRegion = ssoRegion;
    savedProfile.ssoAccountId = selectedAccount.accountId;
    savedProfile.ssoRoleName = selectedRole.roleName;
    saveProfile(savedProfile);
  }

  return credentials;
}
