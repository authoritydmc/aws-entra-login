# aws-entra-login ☁️🔐

[![CI](https://github.com/authoritydmc/aws-entra-login/actions/workflows/ci.yml/badge.svg)](https://github.com/authoritydmc/aws-entra-login/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/aws-entra-login.svg?style=flat&color=brightgreen)](https://www.npmjs.com/package/aws-entra-login)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> **Modern, zero-fragility Microsoft Entra ID (Azure AD) and AWS IAM Identity Center (AWS SSO) authentication CLI tool** supporting Authenticator number matching, Passkeys/FIDO2, Device Code flow, and native AWS `credential_process`.

A modern, clean-room replacement for legacy `aws-azure-login` and a unified companion for AWS SSO that eliminates fragile string scraping, heavy Chromium downloads, and hanging Authenticator prompts.

---

## ✨ Features

- 🏢 **Microsoft Entra ID (Azure AD)**: SAML 2.0 Device Code flow with Authenticator number matching and Passkey support.
- 🔑 **AWS IAM Identity Center (AWS SSO)**: Full OIDC device authorization, account discovery, and role credential management.
- 📱 **Headless & Mobile QR Code**: Works effortlessly in remote SSH terminals and containers via terminal QR code scanning.
- ⚡ **Native AWS `credential_process`**: Zero-maintenance token refresh for Terraform, AWS CLI v2, and SDKs.
- 🚀 **Zero Chromium Requirement**: 100% pure API and OIDC/SAML protocol implementation.
- 🎯 **Interactive Role & Account Selector**: Searchable arrow-key interface for multiple AWS accounts and IAM roles.

---

## 🚀 Installation

```bash
npm install -g aws-entra-login
# or run directly with npx
npx aws-entra-login
# or short alias
npx entra-aws
```

---

## 🛠️ Usage

### A. AWS IAM Identity Center (AWS SSO)

#### 1. Configure AWS SSO Profile
```bash
aws-entra-login sso configure --profile my-sso
```
*Prompts for your AWS SSO Start URL (e.g. `https://my-org.awsapps.com/start`) and SSO Region.*

#### 2. Authenticate with AWS SSO
```bash
aws-entra-login sso login --profile my-sso
# Or: aws-entra-login login --profile my-sso
```
*Opens browser authorization or displays QR code, lists accessible AWS accounts & roles, and stores credentials in `~/.aws/credentials`.*

#### 3. Switch Roles & Accounts on the Fly

Quickly switch your active IAM role or AWS SSO account without re-authenticating:

```bash
# Interactive menu to select from all accessible accounts & roles
aws-entra-login switch --profile prod

# Or switch directly to a specific role / account
aws-entra-login switch --profile prod --role-name AdministratorAccess --account-id 123456789012
```

---

### 4. Cross-Account Role Chaining (Assume Target Role)

Authenticate your base identity via Entra ID or AWS SSO, then automatically assume a target destination IAM role across accounts:

```bash
# Direct command line chaining
aws-entra-login login --profile prod --target-role-arn arn:aws:iam::222233334444:role/CrossAccountDeployer

# Or with switch command
aws-entra-login switch --profile prod --target-role arn:aws:iam::222233334444:role/CrossAccountDeployer
```

---

### B. Microsoft Entra ID (Azure AD)

#### 1. Configure Entra ID Profile
```bash
aws-entra-login configure --profile prod
```
*Prompts for your Microsoft Entra ID Tenant ID, Enterprise App Client ID, and AWS Profile.*

#### 2. Authenticate with Entra ID
```bash
aws-entra-login login --profile prod
```

---

## ⚡ Native AWS `credential_process` Integration

Configure automatic, silent credential refreshing in `~/.aws/config`:

```ini
# Microsoft Entra ID Profile
[profile entra-prod]
credential_process = aws-entra-login get-credentials --profile entra-prod
region = us-east-1

# AWS SSO Profile
[profile sso-prod]
credential_process = aws-entra-login get-credentials --profile sso-prod
region = us-east-1
```

Now, commands like `aws s3 ls --profile sso-prod` or `terraform apply` will automatically invoke `aws-entra-login` and refresh tokens on-demand!

---

## 💻 Extra Commands

### Export Environment Variables to Current Shell
```bash
eval $(aws-entra-login env --profile prod)
```

### Run Subshell / Script with Injected Credentials
```bash
aws-entra-login exec --profile prod -- terraform apply
aws-entra-login exec --profile prod -- aws sts get-caller-identity
```

### List All Configured Profiles
```bash
aws-entra-login list
```

---

## ⚙️ CLI Options Reference

| Command | Option | Description |
| :--- | :--- | :--- |
| `login` | `-p, --profile <name>` | Profile name (default: `default`) |
| `login` | `--sso` | Force AWS IAM Identity Center (SSO) login flow |
| `login` | `-t, --tenant-id <id>` | Entra ID Directory (Tenant) ID |
| `login` | `-a, --app-id <id>` | Azure AD Enterprise App Client ID |
| `login` | `-r, --role-arn <arn>` | Target AWS IAM Role ARN |
| `login` | `--sso-start-url <url>` | AWS SSO Start URL |
| `sso login` | `-p, --profile <name>` | Authenticate via AWS SSO |
| `sso configure` | `-p, --profile <name>` | Interactively configure AWS SSO profile |
| `sso accounts` | `-p, --profile <name>` | List accessible accounts in SSO |
| `configure` | `-p, --profile <name>` | Interactively configure profile settings |
| `get-credentials`| `-p, --profile <name>` | AWS CLI `credential_process` JSON output |
| `env` | `-p, --profile <name>` | Shell `export AWS_...` statements |
| `exec` | `<command...>` | Execute command with assumed AWS environment |

---

## 🧪 Development & Testing

```bash
git clone https://github.com/authoritydmc/aws-entra-login.git
cd aws-entra-login
npm install
npm test
npm run build
```

---

## 📄 License

[MIT](LICENSE) © 2026 authoritydmc
