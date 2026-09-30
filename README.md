# aws-entra-login

> Modern, zero-fragility Microsoft Entra ID (Azure AD) and AWS SSO (IAM Identity Center) authentication CLI tool supporting Authenticator number matching, Device Code flow, AWS Management Console federation, multi-account batch login, and AWS `credential_process`.

[![npm version](https://img.shields.io/npm/v/aws-entra-login.svg)](https://www.npmjs.com/package/aws-entra-login)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features & Capabilities

- 🔐 **Dual Auth Flows:** Seamlessly authenticate with **Microsoft Entra ID (Azure AD SAML)** or **AWS IAM Identity Center (AWS SSO OIDC)**.
- 📱 **Zero-Fragility Mobile & FIDO2 Support:** Authenticator number matching and FIDO2 keys work out of the box via the Microsoft Device Code flow.
- 🌐 **1-Click AWS Web Console Login (`aws-entra-login console`):** Generate signed federation tokens and jump directly into the AWS Management Console in your browser without typing passwords.
- 🩺 **Built-in Doctor & Diagnostics (`aws-entra-login doctor`):** Automatic checks for Entra ID endpoints, STS connectivity, system clock drift, file permissions, and UUID formats.
- 📊 **Real-time Session Status (`aws-entra-login status`):** Live dashboard tracking token countdown timers, active accounts, and assumed IAM roles.
- 🚀 **Multi-Account Batch Login (`aws-entra-login login-all`):** Authenticate once and assume roles across all configured AWS accounts in parallel.
- 🔄 **Auto-Discovery & Migration (`aws-entra-login import-aws`):** Automatically scan and import existing SSO configurations from `~/.aws/config`.
- 🔗 **Cross-Account Role Chaining:** Native `sts:AssumeRole` secondary hop with custom External IDs and session tags.
- ⚡️ **AWS `credential_process` & Shell Export:** Seamless integration with Terraform, CDK, Serverless Framework, and AWS SDKs.

---

## 📦 Installation

```bash
npm install -g aws-entra-login
# or run directly with npx
npx aws-entra-login --help
```

---

## 🚀 Quick Usage

### 1. Authenticate & Assume Role
```bash
# Interactive Entra ID login
aws-entra-login

# AWS SSO (IAM Identity Center) login
aws-entra-login sso

# Switch role/account interactively
aws-entra-login switch
```

### 2. Open AWS Management Console in Browser
```bash
# Generates a signed federation link and opens your browser
aws-entra-login console

# Or specify a profile and region
aws-entra-login console prod --region us-west-2
```

### 3. Diagnose & Verify Setup (`doctor`)
```bash
aws-entra-login doctor
```
Checks:
- Microsoft Entra ID endpoint connectivity
- AWS STS endpoint latency
- System clock synchronization (NTP drift check)
- `~/.aws/credentials` permissions
- Profile configuration UUID sanity

### 4. Check Session Expiration Timers (`status`)
```bash
aws-entra-login status
```
Output:
```
📊 AWS Entra Login — Profile Status Dashboard
────────────────────────────────────────────────────────────

▶ dev [AWS SSO]
  • Destination AWS Profile: dev (configured in ~/.aws/credentials)
  • SSO Access Token:        3h 45m remaining (expires at 17:30:00)
  • Target Account ID:       111122223333
  • Target Role Name:        DeveloperAccess

▶ prod [Entra ID]
  • Destination AWS Profile: prod (configured in ~/.aws/credentials)
  • Default IAM Role:        arn:aws:iam::444455556666:role/ProductionAdmin
```

### 5. Auto-Import from `~/.aws/config`
```bash
aws-entra-login import-aws
```
Automatically scans `~/.aws/config` for existing `sso-session` and `profile` blocks and configures them instantly.

### 6. Batch Multi-Account Login
```bash
aws-entra-login login-all
```
Authenticates once and populates credentials for all configured AWS accounts simultaneously in `~/.aws/credentials`.

---

## 🛠 Integration with Developer Tools

### AWS CLI & SDK (`credential_process`)
Add to `~/.aws/config`:
```ini
[profile entra-dev]
credential_process = aws-entra-login get-credentials -p dev
region = us-east-1
```

### Shell Export for Terraform / Serverless / CDK
```bash
# Export credentials directly into current shell session
eval $(aws-entra-login env -p dev)
```

### Subshell Execution
```bash
# Runs command with AWS credentials injected into environment
aws-entra-login exec -p prod -- terraform apply
aws-entra-login exec -p dev -- aws s3 ls
```

---

## 📄 License

MIT © authoritydmc
