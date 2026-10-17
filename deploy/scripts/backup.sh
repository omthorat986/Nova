#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — SQLite Database Snapshot & Encrypted S3 Backup Script
# Performs a non-blocking online SQLite hot backup, compresses with gzip,
# and archives the snapshot to private S3 with server-side encryption.
# Suitable for automated daily execution via cron.
# ==============================================================================

set -euo pipefail

# Read environment variables if available
if [[ -f /etc/nova/nova.env ]]; then
    # shellcheck disable=SC1091
    source /etc/nova/nova.env
fi

DB_PATH="${NOVA_DB_PATH:-/var/lib/nova/nova.db}"
if [[ ! -f "${DB_PATH}" && -f "/opt/nova/data/nova.db" ]]; then
    DB_PATH="/opt/nova/data/nova.db"
elif [[ ! -f "${DB_PATH}" && -f "/opt/nova/nova.db" ]]; then
    DB_PATH="/opt/nova/nova.db"
fi
BUCKET_NAME="${S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%SZ)
TMP_DIR=$(mktemp -d)
BACKUP_SQLITE="${TMP_DIR}/nova_snapshot_${TIMESTAMP}.sqlite"
BACKUP_ARCHIVE="${BACKUP_SQLITE}.gz"

cleanup() {
    rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

echo "================================================================================"
echo "💾 NOVA Observatory — Starting Database Backup (${TIMESTAMP})"
echo "================================================================================"

if [[ ! -f "${DB_PATH}" ]]; then
    echo "❌ Source database file not found at: ${DB_PATH}"
    exit 1
fi

if [[ -z "${BUCKET_NAME}" ]]; then
    echo "❌ S3_BUCKET is not set. Cannot upload backup."
    exit 1
fi

# 1. Perform non-blocking online hot backup using SQLite .backup API
echo "🔄 [1/3] Creating live SQLite snapshot via .backup API..."
sqlite3 "${DB_PATH}" ".backup '${BACKUP_SQLITE}'"

# Verify snapshot integrity
echo "🔍 Verifying snapshot integrity..."
INTEGRITY=$(sqlite3 "${BACKUP_SQLITE}" "PRAGMA integrity_check;")
if [[ "${INTEGRITY}" != "ok" ]]; then
    echo "❌ Snapshot integrity check failed: ${INTEGRITY}"
    exit 1
fi
echo "✅ Integrity verified: ok"

# 2. Compress snapshot
echo "🗜️ [2/3] Compressing database snapshot..."
gzip -9 "${BACKUP_SQLITE}"
ORIGINAL_SIZE=$(du -h "${DB_PATH}" | cut -f1)
COMPRESSED_SIZE=$(du -h "${BACKUP_ARCHIVE}" | cut -f1)
echo "✅ Compressed ${ORIGINAL_SIZE} -> ${COMPRESSED_SIZE}"

# 3. Upload to private S3 bucket with default SSE-S3 encryption
echo "☁️ [3/3] Uploading encrypted archive to s3://${BUCKET_NAME}/backups/..."
S3_DEST="s3://${BUCKET_NAME}/backups/nova_backup_${TIMESTAMP}.sqlite.gz"
aws s3 cp "${BACKUP_ARCHIVE}" "${S3_DEST}" \
    --region "${AWS_REGION}" \
    --sse AES256

echo "================================================================================"
echo "🎉 Backup Complete! Archive stored at: ${S3_DEST}"
echo "================================================================================"
