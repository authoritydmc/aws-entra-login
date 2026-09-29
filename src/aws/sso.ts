import {
  SSOClient,
  ListAccountsCommand,
  ListAccountRolesCommand,
  GetRoleCredentialsCommand,
} from "@aws-sdk/client-sso";
import { SSOAccount, SSORole, AWSCredentials } from "../types.js";

/**
 * Lists all AWS accounts accessible to the authenticated SSO user.
 */
export async function listSSOAccounts(
  ssoRegion: string,
  accessToken: string
): Promise<SSOAccount[]> {
  const client = new SSOClient({ region: ssoRegion });
  const accounts: SSOAccount[] = [];
  let nextToken: string | undefined;

  do {
    const res = await client.send(
      new ListAccountsCommand({
        accessToken,
        nextToken,
      })
    );

    if (res.accountList) {
      for (const acc of res.accountList) {
        if (acc.accountId) {
          accounts.push({
            accountId: acc.accountId,
            accountName: acc.accountName || acc.accountId,
            emailAddress: acc.emailAddress,
          });
        }
      }
    }

    nextToken = res.nextToken;
  } while (nextToken);

  return accounts;
}

/**
 * Lists all SSO roles assigned to the user in a given AWS account.
 */
export async function listSSORoles(
  ssoRegion: string,
  accessToken: string,
  accountId: string
): Promise<SSORole[]> {
  const client = new SSOClient({ region: ssoRegion });
  const roles: SSORole[] = [];
  let nextToken: string | undefined;

  do {
    const res = await client.send(
      new ListAccountRolesCommand({
        accessToken,
        accountId,
        nextToken,
      })
    );

    if (res.roleList) {
      for (const role of res.roleList) {
        if (role.roleName) {
          roles.push({
            roleName: role.roleName,
            accountId,
          });
        }
      }
    }

    nextToken = res.nextToken;
  } while (nextToken);

  return roles;
}

/**
 * Obtains temporary STS credentials for an SSO account and role.
 */
export async function getSSORoleCredentials(params: {
  ssoRegion: string;
  accessToken: string;
  accountId: string;
  roleName: string;
}): Promise<AWSCredentials> {
  const client = new SSOClient({ region: params.ssoRegion });
  const res = await client.send(
    new GetRoleCredentialsCommand({
      accessToken: params.accessToken,
      accountId: params.accountId,
      roleName: params.roleName,
    })
  );

  if (
    !res.roleCredentials?.accessKeyId ||
    !res.roleCredentials?.secretAccessKey ||
    !res.roleCredentials?.sessionToken
  ) {
    throw new Error(
      `Failed to retrieve AWS SSO credentials for role '${params.roleName}' in account '${params.accountId}'.`
    );
  }

  const expiration = res.roleCredentials.expiration
    ? new Date(res.roleCredentials.expiration)
    : new Date(Date.now() + 3600 * 1000);

  return {
    accessKeyId: res.roleCredentials.accessKeyId,
    secretAccessKey: res.roleCredentials.secretAccessKey,
    sessionToken: res.roleCredentials.sessionToken,
    expiration,
    roleArn: `arn:aws:iam::${params.accountId}:role/aws-reserved/sso.amazonaws.com/${params.roleName}`,
    accountId: params.accountId,
  };
}
