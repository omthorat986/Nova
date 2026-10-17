#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — Production Fast-Forward Update & Deployment Script
# Target: ~/update-nova.sh or /opt/nova/deploy/scripts/update-nova.sh
# Performs zero-downtime / low-impact fast-forward update:
# 1. git pull --ff-only from origin
# 2. rsync source to /opt/nova (excluding .git, venv, logs, .env, and *.db)
# 3. Sets secure permissions (chown nova:nova, chmod 750)
# 4. Updates dependencies via pinned virtualenv
# 5. Executes database schema migrations
# 6. Restarts systemd daemon (nova.service)
# 7. Asserts health via /ready subsystem probe
# ==============================================================================

set -euo pipefail

echo "================================================================================"
echo "🚀 NOVA Observatory — Fast-Forward Update Pipeline"
echo "Timestamp: $(date -u)"
echo "================================================================================"

# Ensure script is run with sudo or root privileges for rsync & systemctl
if [[ $EUID -ne 0 ]]; then
    echo "❌ This script requires administrative privileges. Please run with sudo: sudo $0"
    exit 1
fi

# Determine source repository directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -d "${SCRIPT_DIR}/../../.git" ]]; then
    REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
elif [[ -d "$HOME/Nova/.git" ]]; then
    REPO_DIR="$HOME/Nova"
elif [[ -d "$HOME/website/.git" ]]; then
    REPO_DIR="$HOME/website"
elif [[ -d "$(pwd)/.git" ]]; then
    REPO_DIR="$(pwd)"
else
    REPO_DIR="/home/ubuntu/Nova"
fi

TARGET_DIR="/opt/nova"
VENV_BIN="${TARGET_DIR}/venv/bin"

echo "📂 Source Repository: ${REPO_DIR}"
echo "🎯 Deployment Target: ${TARGET_DIR}"

if [[ ! -d "${REPO_DIR}/.git" ]]; then
    echo "❌ Source repository not found at ${REPO_DIR}. Cannot pull latest changes."
    exit 1
fi

# Step 1: Pull latest changes with fast-forward only
echo ""
echo "📥 [1/6] Pulling latest code (git pull --ff-only)..."
# Determine repo owner to run git as non-root user
REPO_OWNER=$(stat -c '%U' "${REPO_DIR}")
if command -v sudo &>/dev/null && id -u "${REPO_OWNER}" &>/dev/null; then
    sudo -u "${REPO_OWNER}" git -C "${REPO_DIR}" pull --ff-only
else
    git -C "${REPO_DIR}" pull --ff-only
fi
echo "✅ Git fast-forward complete at commit: $(git -C "${REPO_DIR}" rev-parse --short HEAD)"

# Step 2: Rsync files to /opt/nova excluding secrets, logs, db, and environment
echo ""
echo "🔄 [2/6] Synchronizing repository files to ${TARGET_DIR}..."
rsync -av --delete \
    --exclude='.git' \
    --exclude='venv' \
    --exclude='logs' \
    --exclude='.env' \
    --exclude='*.db*' \
    --exclude='*.sqlite*' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    "${REPO_DIR}/" "${TARGET_DIR}/"
echo "✅ File synchronization finished."

# Step 3: Hardened Ownership and File Modes
echo ""
echo "🔒 [3/6] Enforcing security ownership and permissions..."
mkdir -p "${TARGET_DIR}/logs"
mkdir -p /var/lib/nova

chmod 750 "${TARGET_DIR}"
chown -R nova:nova "${TARGET_DIR}"

chmod 750 "${TARGET_DIR}/logs"
chown -R nova:nova "${TARGET_DIR}/logs"

chmod 750 /var/lib/nova
chown -R nova:nova /var/lib/nova
echo "✅ Ownership and permissions verified (mode 750, owner nova:nova)."

# Step 4: Virtualenv dependencies update
echo ""
echo "🐍 [4/6] Checking and installing Python dependencies..."
if [[ -f "${VENV_BIN}/pip" && -f "${TARGET_DIR}/requirements.txt" ]]; then
    sudo -u nova "${VENV_BIN}/pip" install --no-cache-dir -r "${TARGET_DIR}/requirements.txt"
    echo "✅ Dependencies up to date."
else
    echo "⚠️ Virtualenv or requirements.txt not found at ${TARGET_DIR}. Skipping pip install."
fi

# Step 5: Database schema migrations
echo ""
echo "🗄️ [5/6] Applying database schema migrations..."
if [[ -f "${VENV_BIN}/python3" && -f "${TARGET_DIR}/manage.py" ]]; then
    sudo -u nova "${VENV_BIN}/python3" "${TARGET_DIR}/manage.py" migrate
    echo "✅ Database schema verified and migrated."
else
    echo "ℹ️ manage.py or virtualenv python not found. Skipping migration step."
fi

# Step 6: Restart systemd daemon and assert health
echo ""
echo "🔄 [6/6] Restarting nova.service and probing /ready..."
if systemctl is-active --quiet nova.service 2>/dev/null; then
    systemctl restart nova.service
elif systemctl list-unit-files | grep -q "nova.service"; then
    systemctl restart nova.service
else
    echo "ℹ️ Systemd nova.service not found in active units. Attempting reload..."
fi

# Wait briefly for worker processes to bind socket
sleep 2

# Probe readiness probe
READY_URL="http://127.0.0.1:8080/ready"
READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${READY_URL}" || echo "000")
READY_PAYLOAD=$(curl -s "${READY_URL}" || echo "")

if [[ "${READY_STATUS}" == "200" && "${READY_PAYLOAD}" =~ "online" ]]; then
    echo "✅ Readiness probe passed: ${READY_PAYLOAD}"
else
    echo "⚠️ Warning: /ready returned HTTP ${READY_STATUS}. Telemetry: ${READY_PAYLOAD}"
fi

echo ""
echo "================================================================================"
echo "🎉 Update Complete! System active at commit $(git -C "${REPO_DIR}" rev-parse --short HEAD)"
echo "================================================================================"
