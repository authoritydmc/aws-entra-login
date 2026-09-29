import { getProfile, saveProfile } from "./config/profile-store.js";
import { getSSOAccessToken } from "./auth/sso-flow.js";
import { listSSOAccounts, listSSORoles, getSSORoleCredentials } from "./aws/sso.js";
import { promptSelectSSOAccount, promptSelectSSORole } from "./ui/sso-selector.js";
import { writeAwsCredentialsFile } from "./aws/credentials.js";
import { login } from "./login.js";
import { assumeChainedRole } from "./aws/sts.js";
import { AWSCredentials, LoginOptions } from "./types.js";
import picocolors from "picocolors";

export interface SwitchRoleOptions {
  profile?: string;
  roleArn?: string;
  ssoAccountId?: string;
  ssoRoleName?: string;
  targetRoleArn?: string;
  externalId?: string;
  writeCredentials?: boolean;
  quiet?: boolean;
}

/**
 * Interactively switches or updates the active role and account for a profile.
 */
export async function switchRole(options: SwitchRoleOptions = {}): Promise<AWSCredentials> {
  const profileName = options.profile || "default";
  const profile = getProfile(profileName);

  if (!profile) {
    throw new Error(
      `Profile '${profileName}' not found. Please run 'aws-entra-login configure --profile ${profileName}' first.`
    );
  }

  const isSSO = profile.type === "sso" || Boolean(profile.ssoStartUrl);

  if (isSSO) {
    const ssoRegion = profile.ssoRegion || profile.region || "us-east-1";
    const startUrl = profile.ssoStartUrl!;

    // 1. Get Access Token (cached or interactive)
    const accessToken = await getSSOAccessToken(ssoRegion, startUrl, { quiet: options.quiet });

    // 2. Discover accounts & prompt
    const accounts = await listSSOAccounts(ssoRegion, accessToken);
    const selectedAccount = await promptSelectSSOAccount(accounts, options.ssoAccountId);

    // 3. Discover roles & prompt
    const roles = await listSSORoles(ssoRegion, accessToken, selectedAccount.accountId);
    const selectedRole = await promptSelectSSORole(roles, options.ssoRoleName);

    // 4. Retrieve credentials
    let credentials = await getSSORoleCredentials({
      ssoRegion,
      accessToken,
      accountId: selectedAccount.accountId,
      roleName: selectedRole.roleName,
    });

    // 5. Handle cross-account role chaining if requested
    const targetRole = options.targetRoleArn || profile.targetRoleArn;
    if (targetRole) {
      if (!options.quiet) {
        console.log(`\n${picocolors.cyan("⛓ Chaining role assumption to:")} ${picocolors.bold(targetRole)}`);
      }
      credentials = await assumeChainedRole({
        baseCredentials: credentials,
        targetRoleArn: targetRole,
        externalId: options.externalId || profile.externalId,
        region: profile.region,
      });
    }

    // 6. Write credentials
    if (options.writeCredentials !== false) {
      const awsProfileName = profile.awsProfile || profileName;
      const credPath = writeAwsCredentialsFile(awsProfileName, credentials);

      if (!options.quiet) {
        console.log(`\n${picocolors.bold(picocolors.green("✔ Successfully Switched Role!"))}`);
        console.log(`  ${picocolors.cyan("Account:")}     ${picocolors.bold(selectedAccount.accountName)} (${selectedAccount.accountId})`);
        console.log(`  ${picocolors.cyan("Role:")}        ${picocolors.bold(selectedRole.roleName)}`);
        if (targetRole) {
          console.log(`  ${picocolors.cyan("Target Role:")} ${picocolors.bold(targetRole)}`);
        }
        console.log(`  ${picocolors.cyan("Expires:")}     ${credentials.expiration.toLocaleTimeString()}`);
        console.log(`  ${picocolors.cyan("Saved to:")}    ${picocolors.bold(credPath)} [${awsProfileName}]\n`);
      }
    }

    // 7. Update profile
    profile.ssoAccountId = selectedAccount.accountId;
    profile.ssoRoleName = selectedRole.roleName;
    if (options.targetRoleArn) {
      profile.targetRoleArn = options.targetRoleArn;
    }
    saveProfile(profile);

    return credentials;
  } else {
    // Entra ID Role Switch
    const loginOpts: LoginOptions = {
      profile: profileName,
      switchRole: true,
      roleArn: options.roleArn,
      targetRoleArn: options.targetRoleArn,
      externalId: options.externalId,
      writeCredentials: options.writeCredentials,
      quiet: options.quiet,
      force: true,
    };
    return login(loginOpts);
  }
}
