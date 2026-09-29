import { SAMLRolePair } from "../types.js";

/**
 * Extract IAM Role and SAML Provider pairs from a SAML 2.0 assertion.
 * SAML role attributes are formatted as: "arn:aws:iam::123456789012:role/RoleName,arn:aws:iam::123456789012:saml-provider/ProviderName"
 */
export function parseSAMLAssertionRoles(samlXmlOrBase64: string): SAMLRolePair[] {
  let xml = samlXmlOrBase64;
  if (!xml.includes("<") && !xml.includes(">")) {
    try {
      xml = Buffer.from(samlXmlOrBase64, "base64").toString("utf-8");
    } catch {}
  }

  const rolePairs: SAMLRolePair[] = [];

  // Match Role AttributeValues (handling namespaces)
  const roleAttrRegex = /<[^:]*:?AttributeValue[^>]*>([^<]+)<\/[^:]*:?AttributeValue>/gi;
  let match;

  while ((match = roleAttrRegex.exec(xml)) !== null) {
    const val = match[1].trim();
    if (val.includes("arn:aws:iam::") && val.includes(",")) {
      const parts = val.split(",");
      const roleArn = parts.find((p) => p.includes(":role/"))?.trim() || "";
      const principalArn = parts.find((p) => p.includes(":saml-provider/"))?.trim() || "";

      if (roleArn && principalArn) {
        const accountMatch = roleArn.match(/arn:aws:iam::(\d+):role\/(.+)/);
        const accountId = accountMatch ? accountMatch[1] : "unknown";
        const roleName = accountMatch ? accountMatch[2] : roleArn;

        rolePairs.push({
          roleArn,
          principalArn,
          accountId,
          roleName,
        });
      }
    }
  }

  return rolePairs;
}

/**
 * Extract SessionDuration attribute from SAML assertion (in seconds).
 */
export function parseSAMLSessionDuration(samlXmlOrBase64: string): number | undefined {
  let xml = samlXmlOrBase64;
  if (!xml.includes("<") && !xml.includes(">")) {
    try {
      xml = Buffer.from(samlXmlOrBase64, "base64").toString("utf-8");
    } catch {}
  }

  const sessionDurationRegex = /https:\/\/aws\.amazon\.com\/SAML\/Attributes\/SessionDuration[\s\S]*?<[^:]*:?AttributeValue[^>]*>(\d+)<\/[^:]*:?AttributeValue>/i;
  const match = xml.match(sessionDurationRegex);
  if (match) {
    const sec = parseInt(match[1], 10);
    if (!isNaN(sec)) return sec;
  }
  return undefined;
}
