# 🌌 NOVA Deep Space Observatory — Production Cloud Architecture & Engineering Specification

## 1. System Overview & Platform Mission
NOVA is an astrophysical research observatory, celestial planetarium, and deep-space observer community platform. It unites interactive procedural 3D cosmological simulations with a scientific observation dispatch feed organized around verified world space agencies and an open "General Space" celestial channel.

---

## 2. Infrastructure & Cloud Topology (Amazon Web Services)

```text
                           [ Global Space Observers & Public Users ]
                                              │
                                       HTTPS (Port 443)
                                              ▼
                               ┌─────────────────────────────┐
                               │     AWS EC2 (Ubuntu 24.04)  │
                               │  - t3.micro (2 vCPU, 1 GB)  │
                               │  - IMDSv2 Enforced          │
                               │  - 1 GB Fast Swap Space     │
                               │  - AWS SG (Ports 22, 80, 443)│
                               │                             │
                               │   [ Nginx Reverse Proxy ]   │── (Direct Static: /css, /js, /data/*.js only)
                               │     - SSL/TLS Termination   │
                               │     - 6 MB Buffer Limit     │
                               │     - HTTP -> HTTPS 301     │
                               │     - Rate Limit: Auth (5/m)│
                               │     - Rate Limit: API (15/s)│
                               │              │              │
                               │         Proxy :8080         │
                               │              ▼              │
                               │    [ Gunicorn WSGI ]        │
                               │  - 2 Sync Workers           │
                               │  - Max Requests: 1000       │
                               │  - ProxyFix Header Trust    │
                               │              │              │
                               │    [ Flask Web Backend ]    │
                               │              │              │
                               │       [ SQLite 3 DB ]       │
                               │  (/var/lib/nova/nova.db,    │
                               │   WAL Mode, Busy 5000ms,    │
                               │   Foreign Keys Enabled)     │
                               └──────────────┬──────────────┘
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       │ Default Credential   │ Verified Identity    │ Rotating File Logs
                       │ Chain (EC2 IAM Role) │ (noreply@nova.local) │ (/nova/application)
                       ▼                      ▼                      ▼
        ┌─────────────────────────────┐  ┌──────────────┐  ┌─────────────────────────────┐
        │        Amazon S3            │  │   AWS SES    │  │       AWS CloudWatch        │
        │   - Block Public Access: ON │  │ (Optional)   │  │   - Log Groups: /nova/*     │
        │   - SSE-S3 AES-256 Encrypt  │  │ Outreach     │  │   - 14-Day Log Retention    │
        │   - Versioning: Enabled     │  │ Transmission │  │   - Metrics: CPU/Mem/Disk   │
        │   - Presigned URLs (300s)   │  │ to Verified  │  │   - Alarms: CPU > 70%       │
        │   - Scoped: uploads/*,      │  │ Identities   │  │             Disk > 80%      │
        │     avatars/*, banners/*,   │  └──────────────┘  │             5xx / Errors    │
        │     agencies/*, outreach/*, │                    └─────────────────────────────┘
        │     backups/*               │
        └─────────────────────────────┘
```

---

## 3. Relational Data Model & Migrations

The database is managed exclusively through numbered, idempotent SQL migrations in `migrations/`:
1. `001_initial_schema.sql`: Core users, posts, comments, likes, uploads tables.
2. `002_account_security_and_tokens.sql`: Password reset tokens, email verification, session versions.
3. `003_audit_logging.sql`: Audit logs tracking authentication, profile changes, and security events.
4. `004_performance_indexes.sql`: Composite indexes for feeds, queries, and search performance.
5. `005_agencies_as_channels.sql`: Channel architecture anchoring dispatches to space agencies.
6. `006_avatars_and_banners.sql`: Observer and agency avatar keys, banner keys, and color tokens.

### Key Database Tables
- **`agencies`**: Official space agencies (NASA, ESA, ISRO, JAXA, CNSA, Roscosmos, CSA, UAESA) and `general`.
- **`agency_follows`**: Subscriptions mapping observers to followed agency channels.
- **`users`**: Verified observer accounts, Bcrypt password hashes, role RBAC (`curator` / `user`), suspension status.
- **`posts`**: Observation dispatches assigned to an agency channel.
- **`comments`**: Threaded scientific discourse attached to dispatches.
- **`schema_migrations`**: Migration execution registry guaranteeing idempotency.

---

## 4. Cloud Storage Architecture (Amazon S3)

- **Storage Engine**: Abstracts media persistence via `StorageEngine` in `server.py`. In production (`STORAGE_MODE=s3`), files are written to S3; in offline development, local filesystem fallback is used.
- **Zero Public Bucket Access**: S3 Block Public Access is strictly enabled on all 4 settings. Direct requests to S3 object URLs return `403 AccessDenied`.
- **Public Serving via Presigned URLs**: Public `/media/avatar/<id>`, `/media/banner/<id>`, `/media/agency/<slug>/logo` endpoints authenticate the client, issue an HTTP 302 redirect to a short-lived (300s) presigned S3 URL, and attach `Cache-Control: public, max-age=300`.
- **SVG Monogram Fallback**: If an avatar or logo is not present, the server renders a styled SVG monogram tile with HTTP 200 (never 404 or 500).
- **Automated Metadata Stripping**: Uploaded images are decompressed and re-encoded via Pillow, stripping all EXIF and GPS geolocation metadata.
- **Decompression Bomb Protection**: Pillow enforces `Image.MAX_IMAGE_PIXELS = 36_000_000` and maximum dimension 6000px.

---

## 5. Security & Threat Modeling

| Security Layer | Implementation Detail | Target Threat |
| :--- | :--- | :--- |
| **Edge TLS Termination** | Let's Encrypt TLS 1.2+ only, modern ciphers, HSTS `max-age=63072000` | Man-in-the-Middle (MitM) & Eavesdropping |
| **Credential Storage** | Bcrypt with work factor 12, salt, min 10 chars, common password blocklist | Credential Stuffing & Hash Cracking |
| **Brute-Force Lockout** | Sliding window: 5 failed attempts per 15 min triggers 429 & `Retry-After` | Online Brute-Force Attacks |
| **CSRF Protection** | Cryptographic session-bound token validated on all POST/PUT/DELETE | Cross-Site Request Forgery |
| **Content Security Policy** | CSP `default-src 'self'` without `'unsafe-inline'` executable scripts | Cross-Site Scripting (XSS) |
| **Clickjacking Protection** | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` | UI Redressing / Clickjacking |
| **IDOR Protection** | Strict ownership and curator RBAC checked on every dispatch modification | Insecure Direct Object References |
| **Proxy Header Trust** | `ProxyFix(x_for=1, x_proto=1, x_host=1, x_port=1)` in Flask | IP Spoofing & Cache Poisoning |
| **Cloud Credential Guard** | IAM Instance Profile with Default Credential Chain (0 keys in code) | Secret Leakage |
| **SSRF Neutralization** | EC2 IMDSv2 mandatory (`HttpTokens=required`) | Metadata Exfiltration |
| **Database Isolation** | `/var/lib/nova/nova.db` outside Nginx web root, owner `nova:nova`, mode `750` | Direct Database Download & Source Exposure |
| **Preemptive Deny Rules** | Nginx regex returns 404 on `\.(db|log|py|env|pem|key|bak|orig)$`, dotfiles, `/deploy/`, `/logs/` | Source Code & Secret Exposure |
| **Data Path Restriction** | `/data/` location restricted solely to `*.js` data tables; any other access returns 404 | Unauthorized Data File Probing |
| **Process & Group Isolation** | `www-data` in `nova` group (mode 750); `cwagent` in `nova` & `adm` groups | Privilege Escalation & Access Denied |
| **Network Perimeter Guard** | AWS Security Group stateful filtering (ports 22, 80, 443); host UFW disabled | Port Scanning & UFW Lockout Risk |
| **Scoped IAM Readiness Check** | S3 `/ready` probe uses `list_objects_v2` with `Prefix='uploads/'` | Least-Privilege IAM Permission Errors |

---

## 6. Telemetry, Logging & Monitoring

- **Structured JSON Logging**: Every log line in `logs/app.log` and `logs/audit.log` is formatted as a single JSON object with `timestamp`, `level`, `request_id`, `user`, and `ip`.
- **CloudWatch Log Shipping**: The unified CloudWatch agent (user `cwagent`, added to `nova` and `adm` groups) streams application logs and Nginx access/error logs to `/nova/app`, `/nova/access`, `/nova/audit`, and `/nova/nginx/*` with 14-day retention.
- **Metric Alarms**: Configured alarms monitor CPU (> 70%), StatusCheckFailed (> 0), root disk (> 80%), memory (> 80%), and application error counts (> 5 in 5 min) notifying an Amazon SNS email topic.

---

## 7. Multi-Worker Concurrency & Rate Limiting Model

- **Worker Architecture**: Gunicorn runs 2 pre-fork worker processes (`workers = 2`) on `t3.micro` to prevent SQLite WAL concurrency write contention while enabling non-blocking simultaneous read request processing.
- **In-Memory Rate Limiting Scope**: Application-level rate limits (`SlidingWindowLimiter` in `server.py`) store hit records in worker memory protected by a `threading.Lock()`. Because heap memory is private to each worker process, sliding window counters are per-worker. Across 2 workers, worst-case allowable requests before lockout are $2 \times$ the limit if requests alternate evenly.
- **Nginx Unified Rate Limiting (Layer 1)**: Nginx enforces centralized shared-memory rate limits across all incoming requests before proxying to Gunicorn:
  - `limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=5r/m;`
  - `limit_req_zone $binary_remote_addr zone=api_zone:10m rate=15r/s;`
- **Future Multi-Node Scalability**: For multi-instance auto-scaling deployments, rate limiting state should be centralized in an Amazon ElastiCache (Redis) cluster.

---

## 8. Automated Deployment & Continuous Updates

- **Zero-Drift Synchronization**: The production update pipeline script `deploy/scripts/update-nova.sh` automates the release process on EC2:
  - `git pull --ff-only` ensures fast-forward updates without merge conflicts or detached heads.
  - `rsync -av --delete` synchronizes updated source code to `/opt/nova` while strictly preserving runtime state: excludes `.git`, `venv`, `logs`, `.env`, and SQLite database files (`*.db*`).
- **Hardened Permissions Enforcement**:
  - Re-applies `chown -R nova:nova /opt/nova /var/lib/nova`.
  - Re-enforces `chmod 750 /opt/nova /var/lib/nova /opt/nova/logs`.
- **Atomic Migrations & Service Restart**:
  - Runs `/opt/nova/venv/bin/python3 manage.py migrate` to apply pending database schema migrations.
  - Restarts `nova.service` daemon via systemd.
  - Asserts that both database and storage subsystems are fully online via `/ready` before completing.

