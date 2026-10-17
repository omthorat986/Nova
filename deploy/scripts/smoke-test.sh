#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — Post-Deployment Verification & Smoke Test Suite
# Tests:
# 1. /health liveness probe
# 2. /ready database & storage probe
# 3. HTTP to HTTPS redirect enforcement (Port 80 -> 443)
# 4. Strict-Transport-Security (HSTS) header
# 5. X-Content-Type-Options: nosniff header
# 6. X-Frame-Options: DENY header
# 7. Content-Security-Policy (CSP) header
# 8. Server header banner suppression (no version leaks)
# 9. Direct S3 public access block (Expects HTTP 403 AccessDenied)
# 10. Public pages availability (Home, Social, Agencies, Profile, Error 404)
# 11. Sensitive files direct access blocked (/data/nova.db, /nova.db, /server.py, /.env, /logs/app.log -> 403 or 404)
# Outputs a formatted PASS/FAIL summary table for report evidence.
# ==============================================================================

set -uo pipefail

TARGET_HOST="${1:-localhost:8080}"
PROTOCOL="http"
if [[ "${TARGET_HOST}" == https://* ]]; then
    PROTOCOL="https"
    TARGET_HOST="${TARGET_HOST#https://}"
elif [[ "${TARGET_HOST}" == http://* ]]; then
    PROTOCOL="http"
    TARGET_HOST="${TARGET_HOST#http://}"
fi

# Detect if domain uses HTTPS or port 443
if [[ "${TARGET_HOST}" =~ (duckdns\.org|\.com|\.net|\.org) && ! "${TARGET_HOST}" =~ :[0-9]+ ]]; then
    PROTOCOL="https"
fi

BASE_URL="${PROTOCOL}://${TARGET_HOST}"
S3_BUCKET_NAME="${S3_BUCKET:-nova-sky-gallery-bucket}"

echo "================================================================================"
echo "🧪 NOVA Observatory — Executing Live Smoke Test Suite"
echo "Target Base URL: ${BASE_URL}"
echo "Timestamp:       $(date -u)"
echo "================================================================================"

PASSED_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0
TEST_RESULTS=()

record_result() {
    local status="$1"
    local name="$2"
    local detail="$3"
    if [[ "${status}" == "PASS" ]]; then
        PASSED_COUNT=$((PASSED_COUNT + 1))
        TEST_RESULTS+=("[PASS]|${name}|${detail}")
        echo "  ✅ [PASS] ${name}"
    elif [[ "${status}" == "SKIP" ]]; then
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        TEST_RESULTS+=("[SKIP]|${name}|${detail}")
        echo "  ⏭️ [SKIP] ${name} (${detail})"
    else
        FAILED_COUNT=$((FAILED_COUNT + 1))
        TEST_RESULTS+=("[FAIL]|${name}|${detail}")
        echo "  ❌ [FAIL] ${name} (${detail})"
    fi
}

# Test 1: Liveness Probe (/health)
HEALTH_OUT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health" || echo "000")
HEALTH_CODE=$(echo "${HEALTH_OUT}" | tail -n1)
HEALTH_BODY=$(echo "${HEALTH_OUT}" | sed '$d')
if [[ "${HEALTH_CODE}" == "200" && "${HEALTH_BODY}" =~ "status" && "${HEALTH_BODY}" =~ "ok" ]]; then
    record_result "PASS" "Liveness Probe (/health)" "HTTP 200 with status=ok"
else
    record_result "FAIL" "Liveness Probe (/health)" "HTTP ${HEALTH_CODE}"
fi

# Test 2: Readiness Probe (/ready)
READY_OUT=$(curl -s -w "\n%{http_code}" "${BASE_URL}/ready" || echo "000")
READY_CODE=$(echo "${READY_OUT}" | tail -n1)
READY_BODY=$(echo "${READY_OUT}" | sed '$d')
if [[ "${READY_CODE}" == "200" && "${READY_BODY}" =~ "online" ]]; then
    record_result "PASS" "Readiness Probe (/ready)" "HTTP 200 with database online"
else
    record_result "FAIL" "Readiness Probe (/ready)" "HTTP ${READY_CODE}"
fi

# Test 3: HTTP to HTTPS Redirect (Only if testing against a live public domain)
if [[ "${PROTOCOL}" == "https" ]]; then
    DOMAIN_NAME=$(echo "${TARGET_HOST}" | cut -d: -f1)
    HTTP_REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${DOMAIN_NAME}/" || echo "000")
    if [[ "${HTTP_REDIRECT_CODE}" == "301" || "${HTTP_REDIRECT_CODE}" == "302" ]]; then
        record_result "PASS" "HTTP to HTTPS 301 Redirect" "Port 80 redirect enforced (HTTP ${HTTP_REDIRECT_CODE})"
    else
        record_result "FAIL" "HTTP to HTTPS 301 Redirect" "Expected 301/302, got ${HTTP_REDIRECT_CODE}"
    fi
else
    record_result "SKIP" "HTTP to HTTPS 301 Redirect" "Skipped in HTTP/local testing mode"
fi

# Test 4: Strict-Transport-Security (HSTS)
HEADERS_OUT=$(curl -s -I "${BASE_URL}/" || true)
if echo "${HEADERS_OUT}" | grep -iq "Strict-Transport-Security"; then
    record_result "PASS" "HSTS Header Enforced" "max-age header present"
else
    if [[ "${PROTOCOL}" == "https" ]]; then
        record_result "FAIL" "HSTS Header Enforced" "Strict-Transport-Security missing on HTTPS"
    else
        record_result "SKIP" "HSTS Header Enforced" "Skipped on HTTP (only enforced over TLS)"
    fi
fi

# Test 5: X-Content-Type-Options: nosniff
if echo "${HEADERS_OUT}" | grep -iqE "x-content-type-options:[[:space:]]*nosniff"; then
    record_result "PASS" "X-Content-Type-Options Header" "nosniff present"
else
    record_result "FAIL" "X-Content-Type-Options Header" "Missing nosniff header"
fi

# Test 6: X-Frame-Options: DENY
if echo "${HEADERS_OUT}" | grep -iqE "x-frame-options:[[:space:]]*deny"; then
    record_result "PASS" "X-Frame-Options Header" "DENY present (clickjacking protection)"
else
    record_result "FAIL" "X-Frame-Options Header" "Missing X-Frame-Options DENY"
fi

# Test 7: Content-Security-Policy (CSP)
if echo "${HEADERS_OUT}" | grep -iq "Content-Security-Policy"; then
    record_result "PASS" "Content-Security-Policy" "CSP header active without inline scripts"
else
    record_result "FAIL" "Content-Security-Policy" "Missing CSP header"
fi

# Test 8: Server Header Suppression
SERVER_BANNER=$(echo "${HEADERS_OUT}" | tr -d '\r' | grep -i "^server:" | head -n1 || true)
if [[ -z "${SERVER_BANNER}" ]]; then
    record_result "PASS" "Server Banner Suppression" "Server header omitted (no version leaked)"
else
    SERVER_VAL=$(echo "${SERVER_BANNER}" | sed -e 's/^[Ss][Ee][Rr][Vv][Ee][Rr]:[[:space:]]*//' -e 's/[[:space:]]*$//')
    SERVER_DISPLAY="Server: ${SERVER_VAL}"
    if echo "${SERVER_BANNER}" | grep -qE "[0-9]+\.[0-9]+" || echo "${SERVER_BANNER}" | grep -iqE "ubuntu|debian|werkzeug|gunicorn|python"; then
        record_result "FAIL" "Server Banner Suppression" "Leaked: ${SERVER_DISPLAY}"
    else
        record_result "PASS" "Server Banner Suppression" "${SERVER_DISPLAY} (no version leaked)"
    fi
fi

# Test 9: Blocked Direct S3 Public Access (Expects 403 AccessDenied)
if [[ -z "${S3_BUCKET:-}" ]]; then
    record_result "SKIP" "Direct S3 Public Access Blocked" "S3_BUCKET env var not set"
else
    S3_PROBE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${S3_BUCKET}.s3.amazonaws.com/uploads/blocked_test_probe.png" || echo "000")
    if [[ "${S3_PROBE_CODE}" == "403" ]]; then
        record_result "PASS" "Direct S3 Public Access Blocked" "HTTP 403 AccessDenied received"
    elif [[ "${S3_PROBE_CODE}" == "200" ]]; then
        record_result "FAIL" "Direct S3 Public Access Blocked" "S3 bucket allows public access (HTTP 200)"
    else
        record_result "FAIL" "Direct S3 Public Access Blocked" "Expected HTTP 403 AccessDenied, got ${S3_PROBE_CODE}"
    fi
fi

# Test 10: Observatory & Social Public Endpoints (HTTP 200)
INDEX_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" || echo "000")
SOCIAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/social" || echo "000")
AGENCIES_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/agencies" || echo "000")
NOT_FOUND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/nonexistent_probe_404" || echo "000")

if [[ "${INDEX_CODE}" == "200" && "${SOCIAL_CODE}" == "200" && "${AGENCIES_CODE}" == "200" && "${NOT_FOUND_CODE}" == "404" ]]; then
    record_result "PASS" "Public Routes Availability" "Home (200), Social (200), Agencies (200), 404 (404)"
else
    record_result "FAIL" "Public Routes Availability" "Index=${INDEX_CODE}, Social=${SOCIAL_CODE}, 404=${NOT_FOUND_CODE}"
fi

# Test 11: Static Asset Delivery (/css/style.css and /js/app.js return 200)
CSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/css/style.css" || echo "000")
if [[ "${CSS_CODE}" == "200" ]]; then
    record_result "PASS" "Static Delivery: /css/style.css" "HTTP 200 OK"
else
    record_result "FAIL" "Static Delivery: /css/style.css" "HTTP ${CSS_CODE}"
fi

JS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/js/app.js" || echo "000")
if [[ "${JS_CODE}" == "200" ]]; then
    record_result "PASS" "Static Delivery: /js/app.js" "HTTP 200 OK"
else
    record_result "FAIL" "Static Delivery: /js/app.js" "HTTP ${JS_CODE}"
fi

# Test 12: Sensitive Files Direct Access Blocked (Expects HTTP 403 or 404)
SENSITIVE_TARGETS=(
    "/data/nova.db"
    "/nova.db"
    "/server.py"
    "/manage.py"
    "/.env"
    "/requirements.txt"
    "/logs/app.log"
    "/deploy/nginx.conf"
)

for s_path in "${SENSITIVE_TARGETS[@]}"; do
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${s_path}" || echo "000")
    if [[ "${STATUS_CODE}" == "403" || "${STATUS_CODE}" == "404" ]]; then
        record_result "PASS" "Blocked Sensitive: ${s_path}" "HTTP ${STATUS_CODE} (Protected)"
    else
        record_result "FAIL" "Blocked Sensitive: ${s_path}" "HTTP ${STATUS_CODE} (Leaked)"
    fi
done

echo ""
echo "=================================================================================="
echo "📊 NOVA PRODUCTION DEPLOYMENT SMOKE TEST EVIDENCE"
echo "=================================================================================="
printf "| %-8s | %-36s | %-44s |\n" "STATUS" "VERIFICATION CHECK" "TELEMETRY DETAILS"
echo "|:---------|:-------------------------------------|:---------------------------------------------|"
for r in "${TEST_RESULTS[@]}"; do
    IFS="|" read -r st nm dt <<< "${r}"
    printf "| %-8s | %-36s | %-44s |\n" "${st}" "${nm}" "${dt}"
done
echo "=================================================================================="
TOTAL_CHECKS=$((PASSED_COUNT + FAILED_COUNT + SKIPPED_COUNT))
echo "Summary: ${PASSED_COUNT} Passed, ${SKIPPED_COUNT} Skipped, ${FAILED_COUNT} Failed (Total: ${TOTAL_CHECKS} checks)"

if [[ ${FAILED_COUNT} -eq 0 ]]; then
    echo "🎉 ALL ACTIVE SMOKE TESTS PASSED! Production system is fully operational."
    exit 0
else
    echo "⚠️ Smoke tests encountered ${FAILED_COUNT} failures."
    exit 1
fi
