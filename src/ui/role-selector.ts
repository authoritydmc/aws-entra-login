import { select, isCancel } from "@clack/prompts";
import { SAMLRolePair } from "../types.js";

/**
 * Prompt user to select an IAM role from parsed SAML assertion if multiple roles exist.
 */
export async function promptSelectRole(
  roles: SAMLRolePair[],
  defaultRoleArn?: string
): Promise<SAMLRolePair> {
  if (roles.length === 0) {
    throw new Error("No AWS IAM roles found in SAML assertion.");
  }

  if (roles.length === 1) {
    return roles[0];
  }

  // Check if default role is present in list
  if (defaultRoleArn) {
    const matched = roles.find((r) => r.roleArn === defaultRoleArn);
    if (matched) {
      return matched;
    }
  }

  const options = roles.map((r) => ({
    value: r.roleArn,
    label: `${r.roleName} (Account: ${r.accountId})`,
    hint: r.roleArn,
  }));

  const selectedArn = await select({
    message: "Select target AWS IAM Role:",
    options,
    initialValue: defaultRoleArn || roles[0].roleArn,
  });

  if (isCancel(selectedArn)) {
    throw new Error("Role selection cancelled by user.");
  }

  return roles.find((r) => r.roleArn === selectedArn)!;
}
