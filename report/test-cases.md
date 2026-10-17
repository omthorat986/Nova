# 🧪 NOVA Observatory & Cloud Architecture — Verification & Test Matrix

This document details the automated integration and regression test matrix for the **NOVA Space Observatory & Social Platform** (all 41 test cases automated via `python server.py --test` or `python manage.py test`).

---

## 1. Automated Integration Test Suite Matrix (41 Cases)

| Test # | Subsystem / Contract | Description & Validation Criteria | Target Code | Expected Result | Automated Status |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **01** | Liveness Probe | `/health` endpoint responds with process liveness and timestamp | `GET /health` | HTTP 200, status="ok" | ✅ PASS |
| **02** | Readiness Probe | `/ready` validates live DB queries and storage connectivity | `GET /ready` | HTTP 200 (or 503 if down) | ✅ PASS |
| **03** | Security Headers | Enforces HSTS, CSP, nosniff, DENY, Referrer-Policy on all responses | `ALL /` | All security headers present | ✅ PASS |
| **04** | Telemetry Correlation | `X-Request-ID` UUID generated and attached to response headers and logs | `ALL /` | Valid UUID request ID | ✅ PASS |
| **05** | UI Hardening Lint | Zero native `alert()`, `confirm()`, or `prompt()` calls across all JS/HTML | Codebase | 0 native modal calls | ✅ PASS |
| **06** | CSRF Protection | Rejects state-changing POST/PUT/DELETE requests without valid token | `POST /api/*` | HTTP 403 Forbidden | ✅ PASS |
| **07** | Password Policy | Rejects passwords < 10 characters or in common dictionary blocklist | `POST /api/register` | HTTP 400 Bad Request | ✅ PASS |
| **08** | Observer Registration | Registers new user with Bcrypt hash, deterministic avatar color, audit log | `POST /api/register` | HTTP 201 Created | ✅ PASS |
| **09** | Brute-Force Lockout | Locks out account & IP after 5 consecutive failed logins with Retry-After | `POST /api/login` | HTTP 429 Too Many Requests | ✅ PASS |
| **10** | Protected Access | Unauthenticated access to private resources returns structured JSON | `GET /api/me` | HTTP 401 Unauthorized | ✅ PASS |
| **11** | Magic Bytes Validation | Rejects spoofed extension files (e.g. text file renamed to `.png`) | `POST /api/upload` | HTTP 400 Bad Request | ✅ PASS |
| **12** | Telemetry Stripping | Pillow re-encodes images and strips all EXIF and GPS coordinates | `POST /api/upload` | Stored file has 0 EXIF tags | ✅ PASS |
| **13** | Upload Size Ceiling | Rejects uploads exceeding 5 MB with HTTP 413 Payload Too Large | `POST /api/upload` | HTTP 413 Payload Too Large | ✅ PASS |
| **14** | Error Masking | Custom error handlers never leak Python tracebacks or SQL syntax | `ALL 4xx/5xx` | Clean normalized JSON | ✅ PASS |
| **15** | IDOR Ownership | Prevents unauthorized observers from modifying or deleting others' posts | `DELETE /api/posts/*` | HTTP 403 Forbidden | ✅ PASS |
| **16** | Pagination Ceiling | Queries capping `limit` parameter to maximum 50 records per page | `GET /api/feed` | Capped at 50 records | ✅ PASS |
| **17** | Password Reset Token | Single-use hashed reset tokens reject expired (>30m) or reused tokens | `POST /api/reset-pass` | HTTP 400 Bad Request | ✅ PASS |
| **18** | Account Deletion | Full account deletion purges observer profile, follows, and storage files | `DELETE /api/me` | HTTP 200 OK & files purged | ✅ PASS |
| **19** | PII Privacy Shield | Nickname is public; full names and emails are omitted from public APIs | `GET /api/users/*` | Zero email/name leaks | ✅ PASS |
| **20** | Error Recovery Pages | Dedicated styled error templates delivered for 403, 404, and 500 routes | `GET /404.html` | Styled NOVA error layout | ✅ PASS |
| **21** | Agency Channel Binding | Dispatches require a valid agency ID; missing or invalid ID rejected | `POST /api/posts` | HTTP 422 Unprocessable | ✅ PASS |
| **22** | Agency Follow Count | Subscribing and unsubscribing from channels updates counts idempotently | `POST /api/agencies/*/follow` | HTTP 200, correct counts | ✅ PASS |
| **23** | Channel Feed Scoping | Following feed includes followed agencies and excludes unfollowed | `GET /api/feed?tab=following` | Accurate feed filtering | ✅ PASS |
| **24** | Channel Scoped Feed | Filtering by agency slug (`agency=nasa`) returns only that channel's posts | `GET /api/feed?agency=nasa` | Scoped dispatches only | ✅ PASS |
| **25** | Official News Label | External cached news carries `OFFICIAL FEED` label, zero user attribution | `GET /api/agencies/*/news` | Official label enforced | ✅ PASS |
| **26** | Agency Dossier RBAC | Non-curators receive 403 editing agency details; Curators receive 200 | `PATCH /api/agencies/*` | 403 for user, 200 for curator | ✅ PASS |
| **27** | Zero Legacy Terminology | Grep check confirms zero references to legacy consortium/hangar terms | Codebase | 0 legacy occurrences | ✅ PASS |
| **28** | Clean Feed Layout | `/social` contains no inline compose box; standalone `/submit` works | `GET /social`, `/submit` | HTTP 200 OK | ✅ PASS |
| **29** | Dispatch Composer | 3 Tabs (Text, Media, Link), 120/1000 char counters, draft autosave | Client JS | All composer contracts met | ✅ PASS |
| **30** | Topbar & Mobile FAB | Topbar `[ + POST ]`, bell icon, mobile floating action button, key 'C' | Client JS/HTML | All controls active | ✅ PASS |
| **31** | Feed Post Injection | Creating a post returns hydrated agency metadata for dynamic prepending | `POST /api/posts` | HTTP 201 with agency payload | ✅ PASS |
| **32** | Avatar Sizing Pipeline | Avatar upload produces 4 scaled WebP thumbnails (32, 64, 128, 256px) | `POST /api/me/avatar` | HTTP 200, 4 WebP files generated | ✅ PASS |
| **33** | Upload Rejection Guards | Rejects SVG, GIF, spoofed extensions, >3MB, and decompression bombs | `POST /api/me/avatar` | HTTP 400/413 with clean JSON | ✅ PASS |
| **34** | EXIF/GPS Sanitization | Pillow strips all camera metadata and GPS coordinates from avatars | `POST /api/me/avatar` | EXIF byte count = 0 | ✅ PASS |
| **35** | Avatar/Logo RBAC | Regular users cannot edit agency logos or delete other users' avatars | `POST /api/agencies/*/logo` | HTTP 403 Forbidden | ✅ PASS |
| **36** | Storage Object Purge | Uploading a new avatar purges all previous S3 thumbnails automatically | `POST /api/me/avatar` | Old keys deleted from storage | ✅ PASS |
| **37** | Account Deletion Purge | Deleting account deletes avatar and banner images from storage engine | `DELETE /api/me` | HTTP 200 & S3 keys deleted | ✅ PASS |
| **38** | SVG Placeholder Guard | Missing or default avatars return 200 SVG monogram (never 404 or 500) | `GET /media/avatar/*` | HTTP 200 with SVG payload | ✅ PASS |
| **39** | Stable Media URLs | Feed and profile serializers return stable `/media/...` URLs (no S3 leak) | `GET /api/feed` | Zero presigned URL leakage | ✅ PASS |
| **40** | Upload Rate Limiting | Enforces 5 uploads per hour per user with 429 and Retry-After header | `POST /api/me/avatar` | HTTP 429 with Retry-After | ✅ PASS |
| **41** | Unified Avatar Renderer | Grep check: all avatar markup across all pages uses shared component | Codebase | 100% adherence to NovaAvatar | ✅ PASS |
| **42** | S3 Post Upload | Image uploaded with SSE-S3 AES-256 encryption in S3 storage mode | `POST /api/posts` | HTTP 201 & S3 key encrypted AES256 | ✅ PASS |
| **43** | S3 Avatar Old-Key Purge | S3 avatar replacement deletes previous 4 thumbnails from bucket | `POST /api/me/avatar` | HTTP 200 & old keys deleted | ✅ PASS |
| **44** | S3 Presigned URLs | Generates valid presigned S3 URLs expiring in 300s with signature | Storage Engine | Valid S3 URL with signature | ✅ PASS |
| **45** | S3 Account Deletion Purge | Deleting observer account purges all user S3 images from bucket | `DELETE /api/me` | HTTP 200 & zero remaining keys | ✅ PASS |
| **46** | S3 Readiness Probe (503) | `/ready` probe returns 503 Service Unavailable when S3 bucket unreachable | `GET /ready` | HTTP 503 degraded / 200 ready | ✅ PASS |
| **47** | CLI Curator Creation & RBAC | Non-interactive create-curator with bcrypt hash, password policies, audit log, and RBAC | CLI & API | HTTP 200 curator / HTTP 403 observer | ✅ PASS |

---

## 2. Test Execution Command
To execute the automated regression test suite against the application:

```bash
# Direct test execution
python3 server.py --test

# Or using the management CLI
python3 manage.py test
```
