# 🛡️ AWS IAM Security Architecture & Administrator Guidelines

## 1. Zero Root Account Usage
- **Root Account Lockdown**: The AWS root account should NEVER be used for daily management, deployments, or running scripts.
- **Root Protection**:
  1. Set a 32+ character random password.
  2. Enable Hardware or Authenticator App Multi-Factor Authentication (MFA).
  3. Delete all root access keys if any exist.
  4. Lock the root credentials in a corporate password vault.

---

## 2. Dedicated Administrator IAM User
- Create a dedicated IAM user (e.g. `nova-admin`) with the managed policy `AdministratorAccess`.
- Enforce Multi-Factor Authentication (MFA) immediately upon creation.
- Enforce periodic password expiration (90 days) and minimum 16-character complex passwords.

---

## 3. EC2 Instance Metadata Service v2 (IMDSv2)
- All EC2 instances running NOVA MUST enforce **IMDSv2** (session-oriented tokens) to neutralize Server-Side Request Forgery (SSRF) attacks aimed at stealing IAM role credentials:
  ```bash
  aws ec2 modify-instance-metadata-options \
      --instance-id <INSTANCE_ID> \
      --http-tokens required \
      --http-endpoint enabled
  ```

---

## 4. Evaluator Read-Only Credentials
- To provide third-party evaluators or auditors access to review the live cloud architecture:
  1. Create IAM user `nova-evaluator` with console access.
  2. Attach policy `deploy/iam-evaluator-readonly.json`.
  3. Provide temporary credentials and revoke access once evaluation is concluded.
