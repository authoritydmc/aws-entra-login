import { Command } from "commander";
import { text, intro, outro } from "@clack/prompts";
import { login } from "./login.js";
import { ssoLogin } from "./sso-login.js";
import { switchRole } from "./switch.js";
import { saveProfile, listProfiles, getProfile } from "./config/profile-store.js";
import { formatCredentialProcessJSON, formatShellEnv } from "./aws/credentials.js";
import { getSSOAccessToken } from "./auth/sso-flow.js";
import { listSSOAccounts } from "./aws/sso.js";
import { getConsoleLoginUrl, openBrowser } from "./aws/console.js";
import { runDoctor } from "./doctor.js";
import { showProfileStatus } from "./status.js";
import { importAwsProfiles } from "./importer.js";
import { loginAll } from "./batch-login.js";
import { spawn } from "child_process";
import picocolors from "picocolors";

async function main() {
  const program = new Command();

  program
    .name("aws-entra-login")
    .description(
      "Modern, zero-fragility Microsoft Entra ID (Azure AD) and AWS SSO (IAM Identity Center) authentication CLI tool."
    )
    .version("1.3.0", "-v, --version", "Output current version");

  // Default Login Command
  program
    .command("login", { isDefault: true })
    .description("Authenticate with Microsoft Entra ID or AWS SSO and assume AWS Role")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("--sso", "Force AWS IAM Identity Center (SSO) login flow")
    .option("-s, --switch", "Prompt interactively to switch role/account")
    .option("-t, --tenant-id <id>", "Microsoft Entra ID Tenant ID")
    .option("-a, --app-id <id>", "Azure AD Application / Client ID")
    .option("-r, --role-arn <arn>", "Target AWS IAM Role ARN")
    .option("--target-role-arn <arn>", "Cross-account IAM Role ARN to assume via role chaining")
    .option("--external-id <id>", "External ID for cross-account assume role")
    .option("-d, --duration <seconds>", "Session duration in seconds (up to 43200)", (val) => parseInt(val, 10))
    .option("--sso-start-url <url>", "AWS SSO Start URL (e.g. https://my-org.awsapps.com/start)")
    .option("--sso-region <region>", "AWS SSO Region (e.g. us-east-1)")
    .option("--sso-account-id <id>", "AWS SSO Target Account ID")
    .option("--sso-role-name <name>", "AWS SSO Target Role Name")
    .option("--region <region>", "AWS Region")
    .option("-f, --force", "Force re-authentication without using cached tokens")
    .action(async (options) => {
      try {
        await login({
          profile: options.profile,
          sso: options.sso,
          switchRole: options.switch,
          tenantId: options.tenantId,
          appId: options.appId,
          roleArn: options.roleArn,
          targetRoleArn: options.targetRoleArn,
          externalId: options.externalId,
          duration: options.duration,
          ssoStartUrl: options.ssoStartUrl,
          ssoRegion: options.ssoRegion,
          ssoAccountId: options.ssoAccountId,
          ssoRoleName: options.ssoRoleName,
          region: options.region,
          force: options.force,
          writeCredentials: true,
        });
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Switch Role Command
  program
    .command("switch")
    .alias("switch-role")
    .description("Interactively switch active AWS account or IAM role")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("-r, --role-arn <arn>", "Direct target IAM Role ARN")
    .option("--account-id <id>", "Target AWS Account ID (for SSO)")
    .option("--role-name <name>", "Target Role Name (for SSO)")
    .option("--target-role <arn>", "Cross-account destination IAM Role ARN")
    .action(async (options) => {
      try {
        await switchRole({
          profile: options.profile,
          roleArn: options.roleArn,
          ssoAccountId: options.accountId,
          ssoRoleName: options.roleName,
          targetRoleArn: options.targetRole,
          writeCredentials: true,
        });
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Console Command (One-Click AWS Web Console Login)
  program
    .command("console [profile]")
    .description("Generate AWS Management Console federation URL and open in browser")
    .option("-r, --region <region>", "Target AWS Console Region")
    .option("--destination <url>", "Destination URL in AWS Console")
    .option("--no-open", "Do not open browser automatically, print URL only")
    .action(async (profileArg, options) => {
      try {
        const profileName = profileArg || "default";
        const creds = await login({
          profile: profileName,
          writeCredentials: false,
          quiet: true,
        });

        const targetProfile = getProfile(profileName);
        const region = options.region || targetProfile?.region || "us-east-1";

        const consoleUrl = await getConsoleLoginUrl(creds, {
          region,
          destination: options.destination,
        });

        console.log(`\n${picocolors.bold("🌐 AWS Management Console URL:")}`);
        console.log(picocolors.cyan(consoleUrl));

        if (options.open !== false) {
          console.log(`\n${picocolors.green("✔ Opening AWS Console in default browser...")}\n`);
          await openBrowser(consoleUrl);
        } else {
          console.log("");
        }
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Status Command
  program
    .command("status [profile]")
    .description("View active session expiration countdown and profile summary")
    .action((profileArg) => {
      showProfileStatus(profileArg);
    });

  // Doctor Command
  program
    .command("doctor [profile]")
    .description("Run comprehensive diagnostics on Entra ID, STS, clocks, and network")
    .action(async (profileArg) => {
      await runDoctor(profileArg);
    });

  // Import AWS SSO profiles Command
  program
    .command("import-aws")
    .alias("import")
    .description("Auto-discover and import existing SSO profiles from ~/.aws/config")
    .action(() => {
      try {
        const { imported, profiles } = importAwsProfiles();
        if (imported === 0) {
          console.log(picocolors.yellow("\nNo new AWS SSO profiles found in ~/.aws/config.\n"));
          return;
        }

        console.log(`\n${picocolors.green(picocolors.bold(`✔ Successfully imported ${imported} profile(s) from ~/.aws/config:`))}`);
        for (const p of profiles) {
          console.log(`  • ${picocolors.cyan(p.name)} (${p.ssoStartUrl})`);
        }
        console.log("");
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error importing config: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Batch Login Command
  program
    .command("login-all")
    .alias("batch-login")
    .description("Authenticate all configured profiles into ~/.aws/credentials at once")
    .option("-f, --force", "Force re-authentication")
    .action(async (options) => {
      try {
        await loginAll({ force: options.force });
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Dedicated AWS SSO Command Group
  const ssoCmd = program
    .command("sso")
    .description("AWS IAM Identity Center (AWS SSO) authentication commands");

  // Subcommand: sso login
  ssoCmd
    .command("login", { isDefault: true })
    .description("Authenticate via AWS IAM Identity Center (SSO)")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("-s, --switch", "Prompt interactively to switch role/account")
    .option("--start-url <url>", "AWS SSO Start URL")
    .option("--region <region>", "AWS SSO Region")
    .option("--account-id <id>", "AWS SSO Target Account ID")
    .option("--role-name <name>", "AWS SSO Target Role Name")
    .option("--target-role <arn>", "Cross-account destination IAM Role ARN")
    .option("-f, --force", "Force re-authentication")
    .action(async (options) => {
      try {
        await ssoLogin({
          profile: options.profile,
          switchRole: options.switch,
          ssoStartUrl: options.startUrl,
          ssoRegion: options.region,
          ssoAccountId: options.accountId,
          ssoRoleName: options.roleName,
          targetRoleArn: options.targetRole,
          force: options.force,
          writeCredentials: true,
        });
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Subcommand: sso switch
  ssoCmd
    .command("switch")
    .description("Interactively switch AWS SSO account or role")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("--account-id <id>", "Target AWS Account ID")
    .option("--role-name <name>", "Target Role Name")
    .action(async (options) => {
      try {
        await switchRole({
          profile: options.profile,
          ssoAccountId: options.accountId,
          ssoRoleName: options.roleName,
          writeCredentials: true,
        });
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Subcommand: sso configure
  ssoCmd
    .command("configure")
    .description("Interactively configure an AWS IAM Identity Center (SSO) profile")
    .option("-p, --profile <name>", "Profile name to configure", "default")
    .action(async (options) => {
      try {
        intro(picocolors.bold(picocolors.cyan("Configure AWS IAM Identity Center (SSO) Profile")));

        const existing = getProfile(options.profile);

        const startUrl = await text({
          message: "AWS SSO Start URL (e.g. https://my-sso.awsapps.com/start):",
          defaultValue: existing?.ssoStartUrl || "",
          placeholder: "https://my-org.awsapps.com/start",
          validate: (v) => (!v.trim() ? "SSO Start URL is required" : undefined),
        });

        const ssoRegion = await text({
          message: "AWS SSO Region:",
          defaultValue: existing?.ssoRegion || "us-east-1",
        });

        const awsProfile = await text({
          message: "Destination AWS Profile in ~/.aws/credentials:",
          defaultValue: existing?.awsProfile || options.profile,
        });

        const region = await text({
          message: "Default AWS Region for CLI:",
          defaultValue: existing?.region || String(ssoRegion).trim(),
        });

        saveProfile({
          name: options.profile,
          type: "sso",
          ssoStartUrl: String(startUrl).trim(),
          ssoRegion: String(ssoRegion).trim(),
          awsProfile: String(awsProfile).trim(),
          region: String(region).trim(),
        });

        outro(picocolors.green(`✔ AWS SSO Profile '${options.profile}' saved successfully!`));
        console.log(`\nRun ${picocolors.bold(`aws-entra-login sso --profile ${options.profile}`)} to authenticate.\n`);
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Subcommand: sso accounts
  ssoCmd
    .command("accounts")
    .description("List all accessible AWS accounts in SSO Identity Center")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .action(async (options) => {
      try {
        const profile = getProfile(options.profile);
        const startUrl = profile?.ssoStartUrl || process.env.AWS_SSO_START_URL;
        const region = profile?.ssoRegion || "us-east-1";

        if (!startUrl) {
          throw new Error("Missing SSO Start URL. Please run 'aws-entra-login sso configure' first.");
        }

        const accessToken = await getSSOAccessToken(region, startUrl);
        const accounts = await listSSOAccounts(region, accessToken);

        console.log(`\n${picocolors.bold("Accessible AWS Accounts:")}`);
        for (const acc of accounts) {
          console.log(`  • ${picocolors.cyan(picocolors.bold(acc.accountName))} (${acc.accountId}) ${acc.emailAddress ? picocolors.dim(`- ${acc.emailAddress}`) : ""}`);
        }
        console.log("");
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Configure Profile Command (Entra ID)
  program
    .command("configure")
    .description("Interactively configure or update an Entra ID profile")
    .option("-p, --profile <name>", "Profile name to configure", "default")
    .option("--sso", "Configure as AWS SSO profile instead of Entra ID")
    .action(async (options) => {
      try {
        if (options.sso) {
          intro(picocolors.bold(picocolors.cyan("Configure AWS IAM Identity Center (SSO) Profile")));
          const existing = getProfile(options.profile);

          const startUrl = await text({
            message: "AWS SSO Start URL (e.g. https://my-org.awsapps.com/start):",
            defaultValue: existing?.ssoStartUrl || "",
            placeholder: "https://my-org.awsapps.com/start",
            validate: (v) => (!v.trim() ? "SSO Start URL is required" : undefined),
          });

          const ssoRegion = await text({
            message: "AWS SSO Region:",
            defaultValue: existing?.ssoRegion || "us-east-1",
          });

          const awsProfile = await text({
            message: "Destination AWS Profile in ~/.aws/credentials:",
            defaultValue: existing?.awsProfile || options.profile,
          });

          saveProfile({
            name: options.profile,
            type: "sso",
            ssoStartUrl: String(startUrl).trim(),
            ssoRegion: String(ssoRegion).trim(),
            awsProfile: String(awsProfile).trim(),
            region: String(ssoRegion).trim(),
          });

          outro(picocolors.green(`✔ AWS SSO Profile '${options.profile}' saved successfully!`));
          return;
        }

        intro(picocolors.bold(picocolors.cyan("Configure Microsoft Entra ID Profile")));

        const existing = getProfile(options.profile);

        const tenantId = await text({
          message: "Microsoft Entra ID Tenant ID (Directory ID):",
          defaultValue: existing?.tenantId || "",
          placeholder: "e.g. 11111111-2222-3333-4444-555555555555",
          validate: (v) => (!v.trim() ? "Tenant ID is required" : undefined),
        });

        const appId = await text({
          message: "Azure AD Enterprise App / Client ID:",
          defaultValue: existing?.appId || "",
          placeholder: "e.g. aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          validate: (v) => (!v.trim() ? "App ID is required" : undefined),
        });

        const awsProfile = await text({
          message: "Destination AWS Profile in ~/.aws/credentials:",
          defaultValue: existing?.awsProfile || options.profile,
        });

        const region = await text({
          message: "Default AWS Region:",
          defaultValue: existing?.region || "us-east-1",
        });

        saveProfile({
          name: options.profile,
          type: "entra",
          tenantId: String(tenantId).trim(),
          appId: String(appId).trim(),
          awsProfile: String(awsProfile).trim(),
          region: String(region).trim(),
        });

        outro(picocolors.green(`✔ Profile '${options.profile}' saved successfully!`));
        console.log(`\nRun ${picocolors.bold(`aws-entra-login login --profile ${options.profile}`)} to authenticate.\n`);
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // List Profiles Command
  program
    .command("list")
    .description("List all configured profiles")
    .action(() => {
      const profiles = listProfiles();
      if (profiles.length === 0) {
        console.log(picocolors.yellow("No profiles configured yet. Run 'aws-entra-login configure' to create one."));
        return;
      }

      console.log(`\n${picocolors.bold("Configured Profiles:")}`);
      for (const p of profiles) {
        const isSSO = p.type === "sso" || Boolean(p.ssoStartUrl);
        console.log(`  • ${picocolors.cyan(picocolors.bold(p.name))} ${picocolors.magenta(`[${isSSO ? "AWS SSO" : "Entra ID"}]`)}`);
        if (isSSO) {
          console.log(`    Start URL:   ${p.ssoStartUrl}`);
          console.log(`    SSO Region:  ${p.ssoRegion || "us-east-1"}`);
          if (p.ssoAccountId) console.log(`    Account ID:  ${p.ssoAccountId}`);
          if (p.ssoRoleName) console.log(`    Role Name:   ${p.ssoRoleName}`);
        } else {
          console.log(`    Tenant ID:   ${p.tenantId}`);
          console.log(`    App ID:      ${p.appId}`);
          if (p.defaultRoleArn) {
            console.log(`    Default Role: ${p.defaultRoleArn}`);
          }
        }
        if (p.targetRoleArn) {
          console.log(`    Chained Role: ${p.targetRoleArn}`);
        }
        console.log(`    AWS Profile: ${p.awsProfile || p.name}`);
        console.log("");
      }
    });

  // AWS credential_process Command
  program
    .command("get-credentials")
    .description("Output credentials in AWS credential_process JSON format")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("--sso", "Force AWS SSO flow")
    .action(async (options) => {
      try {
        const creds = await login({
          profile: options.profile,
          sso: options.sso,
          writeCredentials: false,
          quiet: true,
        });

        const jsonOutput = formatCredentialProcessJSON(creds);
        console.log(JSON.stringify(jsonOutput));
      } catch (err: any) {
        console.error(JSON.stringify({ error: err.message || String(err) }));
        process.exit(1);
      }
    });

  // Shell Environment Export Command
  program
    .command("env")
    .description("Output credentials as shell export statements")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("--sso", "Force AWS SSO flow")
    .action(async (options) => {
      try {
        const creds = await login({
          profile: options.profile,
          sso: options.sso,
          writeCredentials: false,
          quiet: true,
        });

        console.log(formatShellEnv(creds));
      } catch (err: any) {
        console.error(picocolors.red(`Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Subshell Exec Command
  program
    .command("exec")
    .description("Execute a command with assumed AWS credentials injected into environment")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("--sso", "Force AWS SSO flow")
    .argument("<command...>", "Command to execute with AWS credentials")
    .action(async (cmdArgs, options) => {
      try {
        const creds = await login({
          profile: options.profile,
          sso: options.sso,
          writeCredentials: false,
          quiet: true,
        });

        const [cmd, ...args] = cmdArgs;
        const child = spawn(cmd, args, {
          stdio: "inherit",
          env: {
            ...process.env,
            AWS_ACCESS_KEY_ID: creds.accessKeyId,
            AWS_SECRET_ACCESS_KEY: creds.secretAccessKey,
            AWS_SESSION_TOKEN: creds.sessionToken,
            AWS_SECURITY_TOKEN: creds.sessionToken,
            AWS_CREDENTIAL_EXPIRATION: creds.expiration.toISOString(),
          },
        });

        child.on("exit", (code) => {
          process.exit(code || 0);
        });
      } catch (err: any) {
        console.error(picocolors.red(`Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
