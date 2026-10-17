# 🌌 NOVA Social — Cloud Architecture & Security Engineering Report

**Module:** NOVA Social & Space Agency Tracking Platform  
**Target Environment:** Amazon Web Services (AWS) Production Architecture  
**Security Standard:** Principle of Least Privilege (PoLP), Zero Public Bucket Access, Defense in Depth, Strict PII Privacy Separation  

---

## 1. Executive Summary & Architecture Overview

**NOVA Social** is a deep-space observer telemetry and space agency channel platform integrated into the NOVA Deep Space Observatory. It allows verified observers to transmit astrophysical insights, attach high-resolution spectra and astrophotography, follow research peers, track global space agencies via server-cached RSS feeds and launch manifests, and register research outreach proposals with copy-ready official transmission drafts.

### System Architecture Diagram

```text
                           [ Global Space Observers & Public Users ]
                                              │
                                       HTTPS (Port 443)
                                              ▼
                               ┌─────────────────────────────┐
                               │     AWS EC2 (Ubuntu 24.04)  │
                               │                             │
                               │   [ Nginx Reverse Proxy ]   │── (Direct Static: /css, /js, /data)
                               │     - SSL/TLS Termination   │
                               │     - 6 MB Buffer Limit     │
                               │     - HTTP -> HTTPS 301     │
                               │              │              │
                               │         Proxy :8080         │
                               │              ▼              │
                               │    [ Gunicorn WSGI ]        │
                               │    [ Flask Web Backend ]    │
                               │              │              │
                               │       [ SQLite 3 DB ]       │
                               │   (users, follows, posts,   │
                               │    agencies, outreach, etc) │
                               └──────────────┬──────────────┘
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       │ Default Credential   │ Verified Identity    │ Rotating File Logs
                       │ Chain (EC2 IAM Role) │ (noreply@nova.local) │ (/nova/application)
                       ▼                      ▼                      ▼
        ┌─────────────────────────────┐  ┌──────────────┐  ┌─────────────────────────────┐
        │        Amazon S3            │  │   AWS SES    │  │       AWS CloudWatch        │
        │   - Bucket: Block Public    │  │ (Optional)   │  │   - Log Stream: app.log     │
        │   - ServerSideEncryption    │  │ Outreach     │  │   - Alarm: 5xx Error Count  │
        │     (AES-256)               │  │ Transmission │  │   - Alarm: CPU > 70%        │
        │   - Presigned URLs (300s)   │  │ to Verified  │  │   - Custom Audit Events     │
        │   - Scoped: uploads/*       │  │ Identities   │  │     (register, post,        │
        └─────────────────────────────┘  └──────────────┘  │      follow, outreach, etc) │
                                                           └─────────────────────────────┘
```

---

## 2. Cloud Storage Engine (Amazon S3)

All user-generated media files—including astrophotography uploads, observer avatar portraits, insight post images, and research outreach PDF dossiers—are managed by the `StorageEngine` in `server.py`.

### S3 Security Implementation

1. **Zero Public Bucket Access**:
   The S3 bucket (`nova-sky-gallery-bucket`) is configured with AWS **Block all public access** enabled (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets` all set to `true`). Direct object URLs return `403 Access Denied`.
2. **Server-Side Encryption (AES-256)**:
   Every object is written using AWS S3 envelope encryption enforcing `ServerSideEncryption='AES256'`. The S3 bucket policy further mandates TLS 1.2+ for in-transit encryption (`aws:SecureTransport: "true"`).
3. **Presigned URL Distribution (300s Expiry)**:
   Images and PDF attachments are served to authenticated and public clients strictly via temporary presigned URLs (`s3.generate_presigned_url('get_object', Params={'Bucket': S3_BUCKET, 'Key': s3_key}, ExpiresIn=300)`). URLs expire automatically after 5 minutes, mitigating unauthorized sharing, hotlinking, and crawler indexing.
4. **Partitioned Storage Key Hierarchy**:
   ```text
   uploads/
   ├── {user_id}/{uuid}.{ext}           # Legacy sky gallery submissions
   ├── avatars/{user_id}/{uuid}.{ext}   # User profile avatars (max 5 MB)
   ├── posts/{user_id}/{uuid}.{ext}     # Insight dispatch images (max 5 MB)
   └── outreach/{user_id}/{uuid}.pdf    # Research outreach PDF attachments (max 5 MB)
   ```
5. **Dual-Mode Local Fallback**:
   When running locally (`STORAGE_MODE=local`), files are stored under `local_uploads/uploads/` and served via `/local_uploads/<path>` with identical validation logic, enabling zero-cloud-cost testing.

---

## 3. Identity, IAM & Least Privilege Access

We enforce AWS security best practices by utilizing an **EC2 Instance Profile (IAM Role)** rather than embedding permanent IAM access keys (`AKIA...`) in environment variables or code.

### Scoped IAM Policy (`deploy/iam-policy.json`)

The policy restricts the EC2 instance role strictly to the scoped key prefixes (`uploads/*`, `avatars/*`, `banners/*`, `agencies/*`) and optional SES outbound email for verified identities:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NovaScopedS3UploadsAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::nova-sky-gallery-bucket/uploads/*",
        "arn:aws:s3:::nova-sky-gallery-bucket/avatars/*",
        "arn:aws:s3:::nova-sky-gallery-bucket/banners/*",
        "arn:aws:s3:::nova-sky-gallery-bucket/agencies/*"
      ]
    },
    {
      "Sid": "NovaScopedSESOutreachEmail",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "arn:aws:ses:us-east-1:123456789012:identity/noreply@nova.local"
    }
  ]
}
```

- **No Bucket-Level Deletion**: The policy deliberately omits `s3:DeleteBucket`, `s3:PutBucketPolicy`, and `s3:ListAllMyBuckets`.
- **Prefix Scoping**: The application cannot access or tamper with any root bucket objects outside `uploads/*`, `avatars/*`, `banners/*`, and `agencies/*`.

---

## 4. Privacy Architecture & PII Safeguards

NOVA Social separates public identity from private personally identifiable information (PII):

| Attribute | Visibility | Public Endpoints | Owner Endpoints (`/api/me`) | Security Safeguards |
| :--- | :--- | :--- | :--- | :--- |
| **Nickname** | **PUBLIC** | Returned on `/api/users/<nick>`, `/api/feed`, `/api/posts` | Returned | Unique, case-insensitive, 3-20 characters, `^[a-zA-Z0-9_]{3,20}$` |
| **Full Name** | **PRIVATE** | **NEVER RETURNED** | Visible only to owner/curator | Omitted from serialization queries |
| **Email Address** | **PRIVATE** | **NEVER RETURNED** | Visible only to owner/curator | Case-insensitive uniqueness, bcrypt password pairing |
| **Password** | **PRIVATE** | **NEVER RETURNED** | **NEVER RETURNED** | Irreversible bcrypt hash + per-user salt |
| **Bio & Avatar** | **PUBLIC** | Returned on public profile | Editable via `PATCH /api/me` | Max 160 characters; images verified via Pillow |

### Automated Self-Test Verification (Test 12)
Self-test #12 verifies that querying the public user endpoint (`GET /api/users/<nickname>`) returns `nickname`, `bio`, `avatar_url`, and statistics, but strictly **excludes `full_name`, `name`, and `email`**.

---

## 5. Space Agency Tracking & Server-Side Telemetry Caching

To prevent API hammering, rate-limit depletion, and exposing upstream credentials:
- **Server-Side Fetching**: Upstream RSS feeds and REST APIs are requested exclusively server-side.
- **SQLite Feed Cache (`feed_cache`)**: Responses from official RSS feeds (NASA, ESA), The Space Devs (Launch Library 2), and NASA APOD are cached for 20–30 minutes.
- **Graceful Fault Tolerance**: If upstream servers time out or fail, cached items or authentic fallback telemetry records are returned with a warning logged. The application **never crashes**.

---

## 6. Research Outreach Conduit & Defense-in-Depth

The Research Outreach Conduit enables independent researchers to draft inquiries to official agency outreach offices:
- **Daily Rate Limiting**: Users are strictly limited to **3 outreach submissions per day**, enforced via database count query (`SELECT COUNT(*) FROM outreach WHERE user_id = ? AND date(created_at) = date('now')`).
- **Honest UI Disclosure**: Explicitly discloses that NOVA does not guarantee an agency response.
- **Copy-Ready Draft Generation**: Generates formatted, copyable text with 1-click clipboard triggers and verified links directly to agency contact portals.
- **Optional AWS SES Mode**: When configured (`EMAIL_MODE=ses`), sends email to configured verified identities in SES sandbox.

---

## 7. CloudWatch Monitoring, Alarms & Audit Logging

### Custom Application Audit Logging
Every critical action is logged via `RotatingFileHandler` to `/var/www/nova/logs/app.log` with structured context `[user:CALLSIGN] [ip:CLIENT_IP]`:
- User registration (`User registered successfully: '...' as role '...'`)
- Duplicate nickname/email rejection conflicts
- Session logins and failed authentication attempts (401)
- Space insight post submissions and deletions
- Follow/unfollow actions between observers and agencies
- Research outreach submissions and daily limit rejections (429)
- Upstream RSS and Launch API failures

### CloudWatch Agent Configuration (`deploy/cloudwatch-agent-config.json`)
The CloudWatch agent continuously ships `/var/www/nova/logs/app.log` to `/nova/application` and system metrics (`mem_used_percent`, `disk_used_percent`) to the `NovaSpace/ObservatoryMetrics` namespace.

### CloudWatch Alarms & Operational Thresholds
1. **CPU Utilization Alarm**:
   - Metric: `EC2/CPUUtilization`
   - Threshold: `> 70%` for 2 consecutive 5-minute periods (10 min sustained load)
   - Action: Sends urgent alert to SNS Topic (`NovaHighCPUAlerts`)
2. **HTTP 5xx Error Alarm**:
   - Metric: CloudWatch Metric Filter on `/nova/nginx` or `/nova/application` matching `"[ERROR]"` or `HTTP 5[0-9]{2}`
   - Threshold: `> 5 errors` in a 5-minute period
   - Action: Dispatches notification to on-call engineering SNS topic

---

## 8. Automated Self-Test Suite Results

The comprehensive test suite is executed via `python3 server.py --test`, validating all 18 functional, security, and cloud constraints:

```text
======================================================================
🚀 NOVA SOCIAL & DEEP SPACE OBSERVATORY — AUTOMATED TEST SUITE
======================================================================
| ✅ PASS | 1. Health Endpoint (/health)                               |
| ✅ PASS | 2. Static Content Delivery                                 |
| ✅ PASS | 3. Observer Registration & Session                         |
| ✅ PASS | 4. Bad Login Rejection (401)                               |
| ✅ PASS | 5. Valid Astrophoto Upload (Pending)                       |
| ✅ PASS | 6. Disallowed Extension Rejected (400)                     |
| ✅ PASS | 7. Oversized File (>5MB) Rejected (413/400)                |
| ✅ PASS | 8. Observer Blocked from Approve (403)                     |
| ✅ PASS | 9. Curator Approval Execution (200)                        |
| ✅ PASS | 10. Public Gallery Verification                            |
| ✅ PASS | 11. Duplicate Nickname Rejected (409)                      |
| ✅ PASS | 12. Nickname Public, Name/Email Excluded (Privacy)         |
| ✅ PASS | 13. Follow & Unfollow User Mechanism                       |
| ✅ PASS | 14. Self-Follow Rejected (400)                             |
| ✅ PASS | 15. Post with Image Stored (201 Presigned URL)             |
| ✅ PASS | 16. Observer Blocked (403) / Curator Deletes Post (200)    |
| ✅ PASS | 17. Daily Outreach Limit Enforced (3 Allowed, 4th 429)     |
| ✅ PASS | 18. Upstream Feed Failure Handled Gracefully               |
| ✅ PASS | 19. Dedicated Page Routes Return 200 & Expected <title>    |
| ✅ PASS | 20. /moderation Guard (403 Observer, 200 Curator)          |
| ✅ PASS | 21. Unknown Route Returns Styled 404 Page                  |
| ✅ PASS | 22. Public Profile Contains Nickname, Never Name/Email     |
======================================================================
🎉 ALL 22 TEST CASES PASSED WITH 100% SUCCESS RATE!
```

---

## 9. Conclusion

The **NOVA Social** module fulfills all functional, cloud infrastructure, least-privilege IAM, PII privacy, and operational monitoring standards. It is architected as clean, dedicated pages (`/social`, `/u/<nickname>`, `/agencies`, `/login`, `/register`, `/moderation`, `/404`), preserving `index.html` as the cinematic landing page. It adheres strictly to the existing dark cosmic aerospace aesthetic, hairline 2px borders, monospace telemetry labels, and zero-emoji discipline.
