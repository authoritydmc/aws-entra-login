import test from "node:test";
import assert from "node:assert/strict";
import { parseAwsConfigFile } from "../importer.js";
import { formatTimeRemaining } from "../status.js";

test("parseAwsConfigFile extracts sso profiles and sso-session links", () => {
  const sampleConfig = `
[sso-session my-sso]
sso_start_url = https://my-company.awsapps.com/start
sso_region = us-east-1

[profile dev]
sso_session = my-sso
sso_account_id = 111122223333
sso_role_name = DeveloperAccess
region = us-east-1

[profile prod]
sso_start_url = https://prod-sso.awsapps.com/start
sso_region = eu-west-1
sso_account_id = 444455556666
sso_role_name = ReadOnlyAccess
region = eu-west-1
`;

  const profiles = parseAwsConfigFile(sampleConfig);
  assert.equal(profiles.length, 2);

  const dev = profiles.find((p) => p.name === "dev");
  assert.ok(dev);
  assert.equal(dev.ssoStartUrl, "https://my-company.awsapps.com/start");
  assert.equal(dev.ssoAccountId, "111122223333");
  assert.equal(dev.ssoRoleName, "DeveloperAccess");

  const prod = profiles.find((p) => p.name === "prod");
  assert.ok(prod);
  assert.equal(prod.ssoStartUrl, "https://prod-sso.awsapps.com/start");
  assert.equal(prod.ssoRegion, "eu-west-1");
});

test("formatTimeRemaining displays human readable expiration intervals", () => {
  const inTwoHours = new Date(Date.now() + 2 * 3600 * 1000 + 15 * 60 * 1000);
  const remainingStr = formatTimeRemaining(inTwoHours);
  assert.ok(remainingStr.includes("2h 15m remaining"));

  const inPast = new Date(Date.now() - 10000);
  const expiredStr = formatTimeRemaining(inPast);
  assert.ok(expiredStr.includes("Expired"));
});
