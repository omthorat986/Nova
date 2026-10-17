# 📸 NOVA Deployment Verification & Screenshots Checklist

This checklist enumerates all visual evidence artifacts required to substantiate a secure, production-ready AWS deployment of the **NOVA Space Observatory & Social Platform**.

---

## ☁️ 1. AWS Cloud Infrastructure Evidence

- [ ] **1. IAM Role & Least-Privilege Policy**
  - **Location**: AWS IAM Console -> Roles -> `NovaEC2ServerRole`
  - **Validation Criteria**:
    - Role trust policy shows `ec2.amazonaws.com` principal.
    - Inline policy `NovaScopedAccessPolicy` shows S3 actions (`PutObject`, `GetObject`, `DeleteObject`) restricted exclusively to bucket prefixes (`uploads/*`, `avatars/*`, `banners/*`, `agencies/*`, `backups/*`).
    - CloudWatch Logs write actions restricted to `/nova/*`.
  - **Filename convention**: `evidence_01_iam_role_policy.png`

- [ ] **2. Amazon S3 Bucket Configuration & Policy**
  - **Location**: AWS S3 Console -> Bucket `nova-observatory-prod-<account-id>`
  - **Validation Criteria**:
    - **Block Public Access**: All 4 toggles show "ON".
    - **Default Encryption**: Server-side encryption enabled (SSE-S3 / AES-256).
    - **Bucket Versioning**: Enabled.
    - **Bucket Policy**: Enforces `aws:SecureTransport: "false"` DENY rule and restricts access to `NovaEC2ServerRole`.
  - **Filename convention**: `evidence_02_s3_bucket_policy.png`

- [ ] **3. EC2 Security Group Configuration**
  - **Location**: AWS EC2 Console -> Security Groups -> `nova-web-sg`
  - **Validation Criteria**:
    - **Inbound Rules**:
      - Port 80 (HTTP) -> `0.0.0.0/0` (Let's Encrypt validation & HTTPS redirect).
      - Port 443 (HTTPS) -> `0.0.0.0/0` (Production traffic).
      - Port 22 (SSH) -> Restricted strictly to administrator's public IP (`<IP>/32`).
      - All other inbound ports closed.
  - **Filename convention**: `evidence_03_security_group_rules.png`

- [ ] **4. EC2 Instance Launch & IMDSv2 Enforcement**
  - **Location**: AWS EC2 Console -> Instances -> `nova-server-prod`
  - **Validation Criteria**:
    - Instance Type: `t3.micro`.
    - IAM Role: `NovaEC2ServerRole` attached.
    - Elastic IP attached.
    - Instance Metadata Options: `HttpTokens=required` (IMDSv2 enforced).
  - **Filename convention**: `evidence_04_ec2_instance_imdsv2.png`

- [ ] **5. CloudWatch Metrics Dashboard & Alarms**
  - **Location**: AWS CloudWatch Console -> Alarms
  - **Validation Criteria**:
    - `Nova-EC2-HighCPU` (State: OK / Threshold: > 70%).
    - `Nova-EC2-StatusCheckFailed` (State: OK / Threshold: > 0).
    - `Nova-EC2-HighDiskUtilization` (State: OK / Threshold: > 80%).
    - `Nova-EC2-HighMemoryUtilization` (State: OK / Threshold: > 80%).
    - `Nova-App-5xx-and-Errors` (State: OK / Threshold: >= 5 in 5 min).
    - SNS Topic subscription confirmed.
  - **Filename convention**: `evidence_05_cloudwatch_alarms_ok.png`

- [ ] **6. CloudWatch Log Streams**
  - **Location**: AWS CloudWatch Console -> Log Groups
  - **Validation Criteria**:
    - `/nova/app` shows JSON formatted log entries with `request_id`.
    - `/nova/audit` shows security events (logins, registrations, role changes).
    - `/nova/access` and `/nova/nginx/*` stream live HTTP telemetry.
    - Retention period set to 14 days.
  - **Filename convention**: `evidence_06_cloudwatch_log_streams.png`

---

## 🌐 2. Web Application & Security Evidence

- [ ] **7. HTTPS Padlock & TLS Certificate**
  - **Location**: Browser address bar on `https://your-domain.duckdns.org`
  - **Validation Criteria**:
    - Secure lock icon visible.
    - Certificate viewer shows Let's Encrypt Authority with valid expiry.
    - Connection shows TLS 1.2 or TLS 1.3 with modern cipher suite.
  - **Filename convention**: `evidence_07_https_padlock_cert.png`

- [ ] **8. Automated Smoke Test CLI Output**
  - **Location**: Terminal output from `bash deploy/scripts/smoke-test.sh https://your-domain.duckdns.org`
  - **Validation Criteria**:
    - 10/10 checks PASSED table displayed with green checkmarks.
    - Includes `/health`, `/ready`, HSTS, nosniff, DENY, CSP, server banner suppression, and blocked S3 URL check.
  - **Filename convention**: `evidence_08_smoke_test_pass_table.png`

- [ ] **9. Full Automated Test Suite Execution**
  - **Location**: Terminal output from `python server.py --test`
  - **Validation Criteria**:
    - All 41 integration test cases report `[PASS]`.
    - 100% success rate summary table.
  - **Filename convention**: `evidence_09_automated_tests_41_pass.png`

---

## 🌌 3. User Interface Verification

- [ ] **10. Homepage Observatory View (`/`)**
  - **Validation Criteria**: Cinematic 3D Earth approach, cosmic scale logarithmic controller, planetarium explorer, and visor navigation HUD with responsive layout.
  - **Filename convention**: `evidence_10_home_observatory.png`

- [ ] **11. NOVA Social Dispatch Feed (`/social`)**
  - **Validation Criteria**: Clean dispatch feed without inline compose boxes, active agency filter pills, PostCards with author avatars and agency monograms, and topbar `[ + POST ]` button.
  - **Filename convention**: `evidence_11_social_feed.png`

- [ ] **12. Space Agency Channel View (`/agency/nasa`)**
  - **Validation Criteria**: NASA channel header with official banner, logo monogram, agency telemetry dossier, non-affiliation legal disclosure, and official launch manifests.
  - **Filename convention**: `evidence_12_agency_channel_nasa.png`

- [ ] **13. Observer Profile & Privacy Settings (`/u/<nickname>`)**
  - **Validation Criteria**: Panoramic profile banner, overlapping square avatar with 2px corners, public photo notice, and `[05] EDIT & PRIVACY` tab with canvas crop modal trigger.
  - **Filename convention**: `evidence_13_profile_settings.png`

- [ ] **14. HTML5 Canvas Image Crop Modal**
  - **Validation Criteria**: 1:1 and 3:1 aspect ratio frames, interactive zoom slider (1x–3x), drag-to-pan repositioning, and zero emoji in accordance with the NOVA design system.
  - **Filename convention**: `evidence_14_canvas_crop_modal.png`

- [ ] **15. Themed HTTP Error 404 Recovery (`/nonexistent_route`)**
  - **Validation Criteria**: Dark glassmorphic error panel, interactive background, "Return to Base" navigation button, and zero stack trace leakage.
  - **Filename convention**: `evidence_15_error_404_recovery.png`
