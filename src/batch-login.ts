import picocolors from "picocolors";
import { listProfiles } from "./config/profile-store.js";
import { login } from "./login.js";
import { ssoLogin } from "./sso-login.js";

export interface BatchLoginOptions {
  profiles?: string[];
  force?: boolean;
  quiet?: boolean;
}

export async function loginAll(options: BatchLoginOptions = {}): Promise<void> {
  const allProfiles = listProfiles();

  if (allProfiles.length === 0) {
    console.log(picocolors.yellow("No profiles configured yet. Run 'aws-entra-login configure' or 'aws-entra-login import-aws'."));
    return;
  }

  const targets = options.profiles && options.profiles.length > 0
    ? allProfiles.filter((p) => options.profiles!.includes(p.name))
    : allProfiles;

  console.log(`\n${picocolors.bold("🚀 Multi-Account Batch Authentication")}`);
  console.log(`Authenticating ${picocolors.cyan(targets.length)} profile(s) into ~/.aws/credentials...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const p of targets) {
    const isSSO = p.type === "sso" || Boolean(p.ssoStartUrl);
    process.stdout.write(`• Authenticating [${picocolors.cyan(p.name)}] (${isSSO ? "AWS SSO" : "Entra ID"})... `);

    try {
      if (isSSO) {
        await ssoLogin({
          profile: p.name,
          force: options.force,
          writeCredentials: true,
          quiet: true,
        });
      } else {
        await login({
          profile: p.name,
          force: options.force,
          writeCredentials: true,
          quiet: true,
        });
      }
      console.log(picocolors.green("✔ Done"));
      successCount++;
    } catch (err: any) {
      console.log(picocolors.red(`✖ Failed (${err.message || err})`));
      failCount++;
    }
  }

  console.log(`\n${picocolors.bold("Batch Login Summary:")}`);
  console.log(`  ✔ Successfully authenticated: ${picocolors.green(successCount)}`);
  if (failCount > 0) {
    console.log(`  ✖ Failed: ${picocolors.red(failCount)}`);
  }
  console.log("");
}
