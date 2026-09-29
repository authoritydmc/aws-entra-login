import { select, isCancel, cancel } from "@clack/prompts";
import picocolors from "picocolors";
import { SSOAccount, SSORole } from "../types.js";

/**
 * Prompts user to select an AWS SSO account if multiple are available.
 */
export async function promptSelectSSOAccount(
  accounts: SSOAccount[],
  preselectedAccountId?: string
): Promise<SSOAccount> {
  if (accounts.length === 0) {
    throw new Error("No AWS accounts assigned to your SSO identity.");
  }

  if (preselectedAccountId) {
    const found = accounts.find((a) => a.accountId === preselectedAccountId);
    if (found) return found;
  }

  if (accounts.length === 1) {
    return accounts[0];
  }

  const options = accounts.map((acc) => ({
    value: acc.accountId,
    label: `${acc.accountName} (${acc.accountId})`,
    hint: acc.emailAddress,
  }));

  const selectedValue = await select({
    message: picocolors.bold(picocolors.cyan("Select AWS Account:")),
    options,
  });

  if (isCancel(selectedValue)) {
    cancel("Operation cancelled");
    process.exit(0);
  }

  const matched = accounts.find((a) => a.accountId === selectedValue);
  if (!matched) {
    throw new Error("Selected account not found.");
  }
  return matched;
}

/**
 * Prompts user to select an SSO role if multiple are available in the account.
 */
export async function promptSelectSSORole(
  roles: SSORole[],
  preselectedRoleName?: string
): Promise<SSORole> {
  if (roles.length === 0) {
    throw new Error("No roles available in the selected AWS account.");
  }

  if (preselectedRoleName) {
    const found = roles.find((r) => r.roleName === preselectedRoleName);
    if (found) return found;
  }

  if (roles.length === 1) {
    return roles[0];
  }

  const options = roles.map((role) => ({
    value: role.roleName,
    label: role.roleName,
  }));

  const selectedValue = await select({
    message: picocolors.bold(picocolors.cyan("Select AWS SSO Role:")),
    options,
  });

  if (isCancel(selectedValue)) {
    cancel("Operation cancelled");
    process.exit(0);
  }

  const matched = roles.find((r) => r.roleName === selectedValue);
  if (!matched) {
    throw new Error("Selected role not found.");
  }
  return matched;
}
