import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import {
  parseSAMLAssertionRoles,
  parseSAMLSessionDuration,
  formatCredentialProcessJSON,
  formatShellEnv,
  writeAwsCredentialsFile,
  saveProfile,
  getProfile,
  listProfiles,
} from "../index.js";

// Mock SAML 2.0 XML
const SAMPLE_SAML_XML = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_12345" Version="2.0">
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
    <saml:AttributeStatement>
      <saml:Attribute Name="https://aws.amazon.com/SAML/Attributes/Role">
        <saml:AttributeValue>arn:aws:iam::123456789012:role/EngineeringAdmin,arn:aws:iam::123456789012:saml-provider/AzureAD</saml:AttributeValue>
        <saml:AttributeValue>arn:aws:iam::987654321098:role/ReadOnlyViewer,arn:aws:iam::987654321098:saml-provider/AzureAD</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="https://aws.amazon.com/SAML/Attributes/SessionDuration">
        <saml:AttributeValue>28800</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
`;

test("parseSAMLAssertionRoles extracts multiple IAM roles accurately", () => {
  const roles = parseSAMLAssertionRoles(SAMPLE_SAML_XML);
  assert.strictEqual(roles.length, 2);

  assert.strictEqual(roles[0].roleArn, "arn:aws:iam::123456789012:role/EngineeringAdmin");
  assert.strictEqual(roles[0].principalArn, "arn:aws:iam::123456789012:saml-provider/AzureAD");
  assert.strictEqual(roles[0].accountId, "123456789012");
  assert.strictEqual(roles[0].roleName, "EngineeringAdmin");

  assert.strictEqual(roles[1].roleArn, "arn:aws:iam::987654321098:role/ReadOnlyViewer");
  assert.strictEqual(roles[1].accountId, "987654321098");
  assert.strictEqual(roles[1].roleName, "ReadOnlyViewer");
});

test("parseSAMLSessionDuration extracts session duration seconds", () => {
  const duration = parseSAMLSessionDuration(SAMPLE_SAML_XML);
  assert.strictEqual(duration, 28800);
});

test("formatCredentialProcessJSON formats standard AWS CLI JSON", () => {
  const creds = {
    accessKeyId: "ASIAEXAMPLE123",
    secretAccessKey: "secret456",
    sessionToken: "token789",
    expiration: new Date("2026-10-01T12:00:00Z"),
    roleArn: "arn:aws:iam::123456789012:role/Admin",
    accountId: "123456789012",
  };

  const output = formatCredentialProcessJSON(creds);
  assert.strictEqual(output.Version, 1);
  assert.strictEqual(output.AccessKeyId, "ASIAEXAMPLE123");
  assert.strictEqual(output.Expiration, "2026-10-01T12:00:00.000Z");
});

test("formatShellEnv formats export statements", () => {
  const creds = {
    accessKeyId: "ASIAEXAMPLE123",
    secretAccessKey: "secret456",
    sessionToken: "token789",
    expiration: new Date("2026-10-01T12:00:00Z"),
    roleArn: "arn:aws:iam::123456789012:role/Admin",
    accountId: "123456789012",
  };

  const env = formatShellEnv(creds);
  assert.ok(env.includes('export AWS_ACCESS_KEY_ID="ASIAEXAMPLE123"'));
  assert.ok(env.includes('export AWS_SECRET_ACCESS_KEY="secret456"'));
  assert.ok(env.includes('export AWS_SESSION_TOKEN="token789"'));
});

test("writeAwsCredentialsFile writes and updates credentials file", () => {
  const tmpFile = path.join(os.tmpdir(), `test-aws-creds-${Date.now()}`);

  const creds = {
    accessKeyId: "ASIAKEY1",
    secretAccessKey: "SECRET1",
    sessionToken: "TOKEN1",
    expiration: new Date(),
    roleArn: "arn:aws:iam::123456789012:role/Admin",
    accountId: "123456789012",
  };

  writeAwsCredentialsFile("prod", creds, tmpFile);
  let content = fs.readFileSync(tmpFile, "utf-8");
  assert.ok(content.includes("[prod]"));
  assert.ok(content.includes("aws_access_key_id = ASIAKEY1"));

  // Update profile
  creds.accessKeyId = "ASIAKEY2";
  writeAwsCredentialsFile("prod", creds, tmpFile);
  content = fs.readFileSync(tmpFile, "utf-8");
  assert.ok(content.includes("aws_access_key_id = ASIAKEY2"));

  fs.unlinkSync(tmpFile);
});

test("profile configuration stores and lists profiles", () => {
  saveProfile({
    name: "staging",
    tenantId: "tenant-123",
    appId: "app-456",
    region: "us-west-2",
  });

  const p = getProfile("staging");
  assert.ok(p);
  assert.strictEqual(p?.tenantId, "tenant-123");
  assert.strictEqual(p?.appId, "app-456");

  const list = listProfiles();
  assert.ok(list.some((item) => item.name === "staging"));
});
