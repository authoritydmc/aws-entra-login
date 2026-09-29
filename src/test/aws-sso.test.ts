import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import {
  saveCachedSSOToken,
  loadCachedSSOToken,
} from "../auth/sso-flow.js";
import {
  saveProfile,
  getProfile,
  listProfiles,
} from "../config/profile-store.js";
import { SSOTokenCache } from "../types.js";

test("SSO token caching saves and retrieves valid token", () => {
  const startUrl = `https://test-org-${Date.now()}.awsapps.com/start`;
  const tokenCache: SSOTokenCache = {
    accessToken: "mock-sso-access-token-12345",
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    region: "us-east-1",
    startUrl,
    clientId: "mock-client-id",
    clientSecret: "mock-client-secret",
  };

  saveCachedSSOToken(tokenCache);

  const loaded = loadCachedSSOToken(startUrl);
  assert.ok(loaded);
  assert.strictEqual(loaded?.accessToken, "mock-sso-access-token-12345");
  assert.strictEqual(loaded?.region, "us-east-1");
  assert.strictEqual(loaded?.startUrl, startUrl);
});

test("SSO profile configuration saves and identifies SSO profiles", () => {
  const profileName = `sso-test-${Date.now()}`;
  saveProfile({
    name: profileName,
    type: "sso",
    ssoStartUrl: "https://my-company.awsapps.com/start",
    ssoRegion: "us-east-1",
    ssoAccountId: "112233445566",
    ssoRoleName: "AdministratorAccess",
    awsProfile: "sso-prod",
    region: "us-east-1",
  });

  const p = getProfile(profileName);
  assert.ok(p);
  assert.strictEqual(p?.type, "sso");
  assert.strictEqual(p?.ssoStartUrl, "https://my-company.awsapps.com/start");
  assert.strictEqual(p?.ssoAccountId, "112233445566");
  assert.strictEqual(p?.ssoRoleName, "AdministratorAccess");
  assert.strictEqual(p?.awsProfile, "sso-prod");

  const list = listProfiles();
  assert.ok(list.some((item) => item.name === profileName));
});
