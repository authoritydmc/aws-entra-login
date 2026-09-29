# aws-entra-login ☁️🔐

[![CI](https://github.com/authoritydmc/aws-entra-login/actions/workflows/ci.yml/badge.svg)](https://github.com/authoritydmc/aws-entra-login/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/aws-entra-login.svg?style=flat&color=brightgreen)](https://www.npmjs.com/package/aws-entra-login)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> **Modern, zero-fragility Microsoft Entra ID (formerly Azure AD) to AWS authentication CLI tool** supporting Microsoft Authenticator number matching, Passkeys/FIDO2, Device Code flow, and native AWS `credential_process`.

A modern, clean-room replacement for legacy `aws-azure-login` that eliminates fragile string scraping, heavy Chromium downloads, and hanging Authenticator prompts.

---

## ✨ Why `aws-entra-login`?

| Feature | Legacy `aws-azure-login` | `aws-entra-login` |
| :--- | :--- | :--- |
| **Authenticator Number Matching** | ❌ String-scraping breaks & hangs | ✅ **Zero-browser Device Code & QR flow** |
| **Chromium Dependency** | ❌ Heavy 300MB Puppeteer download | ✅ **Zero browser requirement (Pure API)** |
| **Headless SSH / Remote Server** | ❌ Fails without X11 / GUI | ✅ **100% working via mobile QR code** |
| **Passkeys / FIDO2 / Windows Hello** | ❌ Fails in Puppeteer | ✅ **Native biometrics & Passkey support** |
| **AWS `credential_process`** | ❌ Manual re-login only | ✅ **Automatic refreshing for Terraform & AWS CLI** |
| **Role Selection UI** | ⚠️ Clunky text prompt | ✅ **Interactive arrow-key selector with search** |

---

## 🚀 Installation

### Global CLI Tool
```bash
npm install -g aws-entra-login
# or run directly with npx
npx aws-entra-login
# or short alias
npx entra-aws
```

---

## 🛠️ Quick Start & Usage

### 1. One-Time Profile Configuration
```bash
aws-entra-login configure --profile prod
```
*Prompts for your Microsoft Entra ID Tenant ID, Enterprise App Client ID, and AWS Profile.*

### 2. Authenticate with AWS
```bash
aws-entra-login login --profile prod
```
1. Displays your 8-character user code (e.g. `WDHG-TKPZ`) and renders a terminal QR code.
2. Scan with your phone or open the link, approve with your standard Microsoft Authenticator number matching or biometrics.
3. Select your target IAM role with arrow keys.
4. Temporary credentials are automatically written to `~/.aws/credentials`.

---

## ⚡ Native AWS `credential_process` Integration

Configure automatic, silent credential refreshing in `~/.aws/config`:

```ini
[profile prod]
credential_process = aws-entra-login get-credentials --profile prod
region = us-east-1
```

Now, commands like `aws s3 ls --profile prod` or `terraform apply` will automatically invoke `aws-entra-login` and refresh tokens on-demand!

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

### List Configured Profiles
```bash
aws-entra-login list
```

---

## ⚙️ CLI Options Reference

| Command | Option | Description |
| :--- | :--- | :--- |
| `login` | `-p, --profile <name>` | Profile name (default: `default`) |
| `login` | `-t, --tenant-id <id>` | Entra ID Directory (Tenant) ID |
| `login` | `-a, --app-id <id>` | Azure AD Enterprise App Client ID |
| `login` | `-r, --role-arn <arn>` | Target AWS IAM Role ARN |
| `login` | `-d, --duration <sec>` | Session duration (up to 43200s / 12h) |
| `configure` | `-p, --profile <name>` | Interactively configure profile settings |
| `get-credentials` | `-p, --profile <name>` | AWS CLI `credential_process` JSON output |
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

## 🚀 Automated Release & Versioning

### 1-Click from GitHub Actions
Go to **Actions** -> **Automated Version & Release** -> Select `patch`, `minor`, or `major` -> Click **Run workflow**.

### From Terminal
```bash
npm run release:patch
npm run release:minor
npm run release:major
```

---

## 📄 License

[MIT](LICENSE) © 2026 authoritydmc
