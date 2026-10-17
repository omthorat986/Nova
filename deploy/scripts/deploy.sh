#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — Automated Zero-Downtime Deployment & Rollback Script
# Manages versioned releases, virtualenv packages, schema migrations,
# service reload, health check verification, and automatic rollback on failure.
# Idempotent: keeps the last 3 successful releases.
# ==============================================================================

set -euo pipefail

APP_ROOT="/var/www/nova"
RELEASES_DIR="${APP_ROOT}/releases"
SHARED_DIR="${APP_ROOT}/shared"
CURRENT_LINK="${APP_ROOT}/current"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
NEW_RELEASE="${RELEASES_DIR}/${TIMESTAMP}"
VENV_DIR="${APP_ROOT}/venv"

echo "================================================================================"
echo "🚀 Starting Deployment for NOVA Observatory (Release: ${TIMESTAMP})"
echo "================================================================================"

# Verify root or nova user
if [[ $EUID -ne 0 && $(whoami) != "nova" ]]; then
    echo "❌ Deployment must be run as root or as user 'nova'."
    exit 1
fi

# Ensure prerequisite directories exist
mkdir -p "${RELEASES_DIR}"
mkdir -p "${SHARED_DIR}/logs"
mkdir -p "${SHARED_DIR}/data"

# 1. Prepare Release Codebase
echo "📦 [1/6] Copying application assets into release ${NEW_RELEASE}..."
mkdir -p "${NEW_RELEASE}"

# Determine source directory (current working directory or repo checkout)
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cp -r "${SRC_DIR}/server.py" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/manage.py" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/gunicorn.conf.py" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/requirements.txt" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}"/*.html "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/robots.txt" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/sitemap.xml" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/manifest.json" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/css" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/js" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/data" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/migrations" "${NEW_RELEASE}/"
cp -r "${SRC_DIR}/deploy" "${NEW_RELEASE}/"

# Link shared logs and persistent SQLite data
ln -sfn "${SHARED_DIR}/logs" "${NEW_RELEASE}/logs"

# 2. Virtual Environment & Dependencies
echo "🐍 [2/6] Ensuring Python virtual environment and dependencies..."
if [[ ! -d "${VENV_DIR}" ]]; then
    python3 -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install --no-cache-dir -r "${NEW_RELEASE}/requirements.txt"

# 3. Execute Database Migrations & Channel Seed
echo "🗄️ [3/6] Applying schema migrations & official agency seeds..."
export NOVA_DB_PATH="${SHARED_DIR}/data/nova.db"
export APP_ENV=production
"${VENV_DIR}/bin/python" "${NEW_RELEASE}/server.py" --migrate
"${VENV_DIR}/bin/python" "${NEW_RELEASE}/server.py" --seed

# Fix ownership
chown -R nova:nova "${NEW_RELEASE}"
chown -R nova:nova "${SHARED_DIR}"
chown -R nova:nova "${VENV_DIR}"

# Store previous release for rollback
PREVIOUS_RELEASE=""
if [[ -L "${CURRENT_LINK}" ]]; then
    PREVIOUS_RELEASE=$(readlink -f "${CURRENT_LINK}")
fi

# 4. Activate New Release Symlink
echo "🔗 [4/6] Activating symlink to current release..."
ln -sfn "${NEW_RELEASE}" "${CURRENT_LINK}"

# 5. Reload Application Daemon & Run Health Probe
echo "🔄 [5/6] Restarting nova.service and verifying health probe..."
systemctl restart nova.service

# Health probe polling with 15-second grace window
HEALTH_OK=false
# shellcheck disable=SC2034
for attempt in {1..15}; do
    if curl -s -f http://127.0.0.1:8080/health >/dev/null 2>&1; then
        HEALTH_OK=true
        break
    fi
    sleep 1
done

if [[ "${HEALTH_OK}" == "true" ]]; then
    echo "✅ Health check PASSED! HTTP 200 received from /health."
else
    echo "❌ Health check FAILED! Service did not respond with 200 within 15 seconds."
    if [[ -n "${PREVIOUS_RELEASE}" && -d "${PREVIOUS_RELEASE}" ]]; then
        echo "🚨 INITIATING AUTOMATIC ROLLBACK to ${PREVIOUS_RELEASE}..."
        ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT_LINK}"
        systemctl restart nova.service
        echo "⚠️ Rolled back successfully to previous release."
    else
        echo "⚠️ No previous release available to roll back to."
    fi
    exit 1
fi

# 6. Housekeeping: Keep only the last 3 releases
echo "🧹 [6/6] Cleaning up old releases (retaining last 3)..."
cd "${RELEASES_DIR}"
# shellcheck disable=SC2012
ls -dt ./*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf

echo "================================================================================"
echo "🎉 Deployment SUCCESSFUL! Running release: ${NEW_RELEASE}"
echo "================================================================================"
