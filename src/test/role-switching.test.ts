import test from "node:test";
import assert from "node:assert";
import { saveProfile, getProfile } from "../config/profile-store.js";
import { EntraProfile } from "../types.js";

test("Profile stores targetRoleArn for cross-account role chaining", () => {
  const profileName = `chain-test-${Date.now()}`;
  const profile: EntraProfile = {
    name: profileName,
    type: "sso",
    ssoStartUrl: "https://my-org.awsapps.com/start",
    ssoRegion: "us-east-1",
    ssoAccountId: "111122223333",
    ssoRoleName: "SecurityAuditor",
    targetRoleArn: "arn:aws:iam::444455556666:role/ProductionReadOnly",
    externalId: "ext-12345",
  };

  saveProfile(profile);

  const loaded = getProfile(profileName);
  assert.ok(loaded);
  assert.strictEqual(loaded?.targetRoleArn, "arn:aws:iam::444455556666:role/ProductionReadOnly");
  assert.strictEqual(loaded?.externalId, "ext-12345");
  assert.strictEqual(loaded?.ssoRoleName, "SecurityAuditor");
});

test("Profile updates active role when switching", () => {
  const profileName = `switch-test-${Date.now()}`;
  const profile: EntraProfile = {
    name: profileName,
    type: "entra",
    tenantId: "tenant-aaa",
    appId: "app-bbb",
    defaultRoleArn: "arn:aws:iam::111111111111:role/DevRole",
  };

  saveProfile(profile);

  // Switch role
  profile.defaultRoleArn = "arn:aws:iam::111111111111:role/AdminRole";
  saveProfile(profile);

  const updated = getProfile(profileName);
  assert.strictEqual(updated?.defaultRoleArn, "arn:aws:iam::111111111111:role/AdminRole");
});
