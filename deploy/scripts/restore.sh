#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — Database Restoration Procedure
# Downloads an encrypted database snapshot from S3, verifies integrity,
# backs up the current active database as a safeguard, and restores data.
# Requires explicit interactive confirmation before touching production data.
# ==============================================================================

set -euo pipefail

if [[ -f /etc/nova/nova.env ]]; then
    # shellcheck disable=SC1091
    source /etc/nova/nova.env
fi

DB_PATH="${NOVA_DB_PATH:-/opt/nova/data/nova.db}"
BUCKET_NAME="${S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "================================================================================"
echo "⚠️  NOVA Observatory — Database Restoration Procedure"
echo "================================================================================"

if [[ $EUID -ne 0 && $(whoami) != "nova" ]]; then
    echo "❌ Restore script must be run as root or as user 'nova'."
    exit 1
fi

if [[ -z "${BUCKET_NAME}" ]]; then
    echo "❌ S3_BUCKET environment variable is not defined."
    exit 1
fi

# List available backups in S3
echo "📋 Available backups in s3://${BUCKET_NAME}/backups/:"
aws s3 ls "s3://${BUCKET_NAME}/backups/" --region "${AWS_REGION}" | tail -n 10
echo ""

read -rp "Enter S3 backup filename to restore (e.g., nova_backup_20261017_120000Z.sqlite.gz): " BACKUP_FILE
if [[ -z "${BACKUP_FILE}" ]]; then
    echo "❌ No backup file specified. Aborting."
    exit 1
fi

echo ""
echo "🚨 DANGER: This will STOP the running service and OVERWRITE the active database."
echo "Active target: ${DB_PATH}"
echo ""
read -rp "Type 'RESTORE' in all caps to proceed: " CONFIRMATION
if [[ "${CONFIRMATION}" != "RESTORE" ]]; then
    echo "❌ Restoration aborted by user."
    exit 0
fi

TMP_DIR=$(mktemp -d)
cleanup() {
    rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# 1. Download Backup Archive
echo "☁️ [1/5] Downloading snapshot from S3..."
S3_URI="s3://${BUCKET_NAME}/backups/${BACKUP_FILE}"
LOCAL_ARCHIVE="${TMP_DIR}/restore.sqlite.gz"
LOCAL_SQLITE="${TMP_DIR}/restore.sqlite"

aws s3 cp "${S3_URI}" "${LOCAL_ARCHIVE}" --region "${AWS_REGION}"
gunzip -c "${LOCAL_ARCHIVE}" > "${LOCAL_SQLITE}"

# 2. Verify Integrity of Downloaded Database
echo "🔍 [2/5] Verifying integrity of restored database..."
INTEGRITY=$(sqlite3 "${LOCAL_SQLITE}" "PRAGMA integrity_check;")
if [[ "${INTEGRITY}" != "ok" ]]; then
    echo "❌ Integrity check failed on downloaded snapshot: ${INTEGRITY}. Aborting."
    exit 1
fi
echo "✅ Integrity check passed: ok"

# 3. Stop Application Daemon & Backup Current State
echo "⏹️  [3/5] Stopping nova.service..."
systemctl stop nova.service || true

if [[ -f "${DB_PATH}" ]]; then
    SAFEGUARD="${DB_PATH}.pre_restore_$(date +%Y%m%d%H%M%S).bak"
    echo "🛡️ Creating local safety backup of current database at ${SAFEGUARD}..."
    cp "${DB_PATH}" "${SAFEGUARD}"
fi

# 4. Replace Database File and Reset Journals
echo "🔄 [4/5] Restoring database file..."
mkdir -p "$(dirname "${DB_PATH}")"
cp "${LOCAL_SQLITE}" "${DB_PATH}"
rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
chown nova:nova "${DB_PATH}"
chmod 640 "${DB_PATH}"

# Ensure WAL mode and busy timeout on restored file
sqlite3 "${DB_PATH}" "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;"

# 5. Restart Application Daemon
echo "▶️  [5/5] Restarting nova.service..."
systemctl start nova.service

# Verify health probe
sleep 2
if curl -s -f http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "✅ Health check PASSED after restore."
else
    echo "⚠️ Warning: Health check did not immediately respond. Inspect logs with: journalctl -u nova -n 50"
fi

echo "================================================================================"
echo "🎉 Restoration completed successfully!"
echo "================================================================================"
