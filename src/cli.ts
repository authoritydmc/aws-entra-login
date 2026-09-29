import { Command } from "commander";
import { text, intro, outro } from "@clack/prompts";
import { login } from "./login.js";
import { saveProfile, listProfiles, getProfile } from "./config/profile-store.js";
import { formatCredentialProcessJSON, formatShellEnv } from "./aws/credentials.js";
import { spawn } from "child_process";
import picocolors from "picocolors";

async function main() {
  const program = new Command();

  program
    .name("aws-entra-login")
    .description(
      "Modern, zero-fragility Microsoft Entra ID (Azure AD) to AWS authentication CLI tool."
    )
    .version("1.0.0", "-v, --version", "Output current version");

  // Default Login Command
  program
    .command("login", { isDefault: true })
    .description("Authenticate with Microsoft Entra ID and assume AWS IAM Role")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .option("-t, --tenant-id <id>", "Microsoft Entra ID Tenant ID")
    .option("-a, --app-id <id>", "Azure AD Application / Client ID")
    .option("-r, --role-arn <arn>", "Target AWS IAM Role ARN")
    .option("-d, --duration <seconds>", "Session duration in seconds (up to 43200)", (val) => parseInt(val, 10))
    .option("--region <region>", "AWS Region")
    .action(async (options) => {
      try {
        await login({
          profile: options.profile,
          tenantId: options.tenantId,
          appId: options.appId,
          roleArn: options.roleArn,
          duration: options.duration,
          region: options.region,
          writeCredentials: true,
        });
      } catch (err: any) {
        console.error(picocolors.red(`\n✖ Error: ${err.message || err}`));
        process.exit(1);
      }
    });

  // Configure Profile Command
  program
    .command("configure")
    .description("Interactively configure or update an Entra ID profile")
    .option("-p, --profile <name>", "Profile name to configure", "default")
    .action(async (options) => {
      try {
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

      console.log(`\n${picocolors.bold("Configured Entra ID Profiles:")}`);
      for (const p of profiles) {
        console.log(`  • ${picocolors.cyan(picocolors.bold(p.name))}`);
        console.log(`    Tenant ID:   ${p.tenantId}`);
        console.log(`    App ID:      ${p.appId}`);
        console.log(`    AWS Profile: ${p.awsProfile || p.name}`);
        if (p.defaultRoleArn) {
          console.log(`    Default Role: ${p.defaultRoleArn}`);
        }
        console.log("");
      }
    });

  // AWS credential_process Command
  program
    .command("get-credentials")
    .description("Output credentials in AWS credential_process JSON format")
    .option("-p, --profile <name>", "Configuration profile name", "default")
    .action(async (options) => {
      try {
        const creds = await login({
          profile: options.profile,
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
    .action(async (options) => {
      try {
        const creds = await login({
          profile: options.profile,
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
    .argument("<command...>", "Command to execute with AWS credentials")
    .action(async (cmdArgs, options) => {
      try {
        const creds = await login({
          profile: options.profile,
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
