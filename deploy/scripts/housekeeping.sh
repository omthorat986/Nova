#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — Automated Maintenance & Housekeeping Cron Script
# Purges expired password reset tokens, stale cache entries, expired sessions,
# and detects orphaned S3 uploads. Recommended cron schedule: Hourly.
# ==============================================================================

set -euo pipefail

if [[ -f /etc/nova/nova.env ]]; then
    # shellcheck disable=SC1091
    source /etc/nova/nova.env
fi

APP_DIR="${APP_DIR:-/var/www/nova/current}"
VENV_DIR="${VENV_DIR:-/var/www/nova/venv}"

echo "================================================================================"
echo "🧹 NOVA Observatory — Starting Housekeeping Routine ($(date -u))"
echo "================================================================================"

if [[ -d "${APP_DIR}" && -f "${APP_DIR}/scripts/housekeeping.py" && -f "${VENV_DIR}/bin/python" ]]; then
    "${VENV_DIR}/bin/python" "${APP_DIR}/scripts/housekeeping.py"
elif [[ -f "scripts/housekeeping.py" ]]; then
    python3 scripts/housekeeping.py
else
    echo "⚠️ scripts/housekeeping.py not found. Running direct SQLite maintenance..."
    DB_PATH="${NOVA_DB_PATH:-/var/www/nova/shared/data/nova.db}"
    if [[ -f "${DB_PATH}" ]]; then
        NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        sqlite3 "${DB_PATH}" "
            UPDATE users SET reset_token_hash = NULL, reset_token_expires_at = NULL WHERE reset_token_expires_at IS NOT NULL AND reset_token_expires_at < '${NOW_ISO}';
            DELETE FROM feed_cache WHERE updated_at < datetime('now', '-24 hours');
            PRAGMA optimize;
        "
        echo "✅ Direct database maintenance complete."
    fi
fi

echo "================================================================================"
echo "🎉 Housekeeping completed successfully."
echo "================================================================================"
