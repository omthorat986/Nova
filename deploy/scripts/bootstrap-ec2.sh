#!/usr/bin/env bash
# ==============================================================================
# NOVA Observatory — EC2 Instance Bootstrap Script (Ubuntu 22.04 / 24.04 LTS)
# Sets up a hardened, production-ready environment for a t3.micro instance.
# Idempotent: safe to run multiple times.
# ==============================================================================

set -euo pipefail

echo "================================================================================"
echo "🚀 NOVA Observatory — Bootstrapping AWS EC2 Instance"
echo "================================================================================"

# Ensure script is run with root privileges
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (or with sudo)."
   exit 1
fi

# Detect Linux distribution
if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    OS_ID="${ID:-}"
else
    OS_ID="unknown"
fi

# 1 & 2. Install essential system dependencies and pin Python >= 3.11
echo "📦 [1/8] Installing dependencies and pinning Python >= 3.11 for ${OS_ID}..."
if [[ "${OS_ID}" == "amzn" ]]; then
    # Amazon Linux 2023 default python3 is 3.9; explicitly install python3.11
    dnf check-update -y || true
    dnf install -y \
        python3.11 \
        python3.11-pip \
        python3.11-devel \
        nginx \
        git \
        sqlite \
        tar \
        gzip \
        curl
    PYTHON_BIN="/usr/bin/python3.11"
else
    # Ubuntu / Debian
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends \
        nginx \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        build-essential \
        libjpeg-dev \
        zlib1g-dev \
        git \
        curl \
        sqlite3 \
        certbot \
        python3-certbot-nginx
    PYTHON_BIN="/usr/bin/python3"
fi

# Verify Python version >= 3.11
PY_VER=$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=$($PYTHON_BIN -c 'import sys; print(sys.version_info.major)')
PY_MINOR=$($PYTHON_BIN -c 'import sys; print(sys.version_info.minor)')
if [[ "$PY_MAJOR" -lt 3 ]] || [[ "$PY_MAJOR" -eq 3 && "$PY_MINOR" -lt 11 ]]; then
    echo "❌ Python >= 3.11 is required, but found Python ${PY_VER} at ${PYTHON_BIN}"
    exit 1
fi
echo "✅ Python version verified: ${PY_VER} (${PYTHON_BIN})"

# 3. Configure automatic security updates if unattended-upgrades available
if command -v unattended-upgrades &>/dev/null; then
    echo "🔒 [2/8] Enabling unattended security upgrades..."
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
    systemctl restart unattended-upgrades || true
fi

# 4. Configure 1 GB Swap Space (Crucial for 1 GB RAM on t3.micro)
echo "💾 [3/8] Configuring swap partition (1 GB)..."
SWAPFILE="/swapfile"
if [[ ! -f "$SWAPFILE" ]]; then
    fallocate -l 1G "$SWAPFILE" || dd if=/dev/zero of="$SWAPFILE" bs=1M count=1024
    chmod 600 "$SWAPFILE"
    mkswap "$SWAPFILE"
    swapon "$SWAPFILE"
    echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
    sysctl vm.swappiness=10
    echo "vm.swappiness=10" >> /etc/sysctl.conf
    echo "✅ Swap file created and active."
else
    echo "ℹ️ Swap file already exists. Skipping allocation."
fi

# 5. Create non-root system user and directory structure at /opt/nova
echo "👤 [4/8] Creating system user 'nova' and directory layout at /opt/nova..."
if ! id -u nova &>/dev/null; then
    useradd --system --shell /bin/bash --create-home --home-dir /opt/nova nova
    echo "✅ Created system user 'nova'."
fi

mkdir -p /opt/nova
mkdir -p /opt/nova/logs
mkdir -p /opt/nova/data
mkdir -p /var/lib/nova
mkdir -p /etc/nova

# Create virtualenv using pinned Python binary if not already present
if [[ ! -d /opt/nova/venv ]]; then
    echo "🐍 Creating virtualenv at /opt/nova/venv using ${PYTHON_BIN}..."
    $PYTHON_BIN -m venv /opt/nova/venv
    /opt/nova/venv/bin/pip install --upgrade pip
fi

chmod 750 /opt/nova
chown -R nova:nova /opt/nova

# Secure production database directory outside Nginx web root
chmod 750 /var/lib/nova
chown -R nova:nova /var/lib/nova
echo "✅ Production database directory /var/lib/nova secured (mode 750, owner nova:nova)."

# Add Nginx user (www-data / nginx) to nova group for static asset traversal
if id -u www-data &>/dev/null; then
    usermod -a -G nova www-data || true
    echo "✅ Added 'www-data' to group 'nova'."
elif id -u nginx &>/dev/null; then
    usermod -a -G nova nginx || true
    echo "✅ Added 'nginx' to group 'nova'."
fi

# 6. Firewall Configuration (Managed at AWS Security Group Level)
echo "🛡️ [5/8] Firewall managed via AWS Security Group (ports 22, 80, 443). Skipping UFW configuration."

# 7. Install AWS CloudWatch Agent
echo "📊 [6/8] Installing AWS CloudWatch Unified Agent..."
if ! command -v amazon-cloudwatch-agent-ctl &>/dev/null; then
    if [[ "${OS_ID}" == "amzn" ]]; then
        dnf install -y amazon-cloudwatch-agent || {
            TEMP_DIR=$(mktemp -d)
            curl -fsSL https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm -o "${TEMP_DIR}/amazon-cloudwatch-agent.rpm"
            rpm -Uvh "${TEMP_DIR}/amazon-cloudwatch-agent.rpm"
            rm -rf "${TEMP_DIR}"
        }
    else
        TEMP_DIR=$(mktemp -d)
        curl -fsSL https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o "${TEMP_DIR}/amazon-cloudwatch-agent.deb"
        dpkg -i "${TEMP_DIR}/amazon-cloudwatch-agent.deb"
        rm -rf "${TEMP_DIR}"
    fi
    echo "✅ CloudWatch Agent installed."
else
    echo "ℹ️ CloudWatch Agent already installed."
fi

# 8. Create production environment file template if missing
echo "📝 [7/8] Checking production environment file (/etc/nova/nova.env)..."
if [[ ! -f /etc/nova/nova.env ]]; then
    touch /etc/nova/nova.env
    chmod 600 /etc/nova/nova.env
    chown nova:nova /etc/nova/nova.env
    echo "ℹ️ Created empty /etc/nova/nova.env (restricted chmod 600)."
fi

echo "================================================================================"
echo "🎉 Bootstrap Complete!"
echo "📦 [8/8] Getting Code Onto EC2 (/opt/nova):"
echo "--------------------------------------------------------------------------------"
echo "Method A: Git Clone to /opt/nova (Recommended)"
echo "  sudo git clone -b deploy-ready <YOUR_GIT_REPO_URL> /opt/nova"
echo "  sudo chown -R nova:nova /opt/nova"
echo "  sudo -u nova /opt/nova/venv/bin/pip install -r /opt/nova/requirements.txt"
echo ""
echo "Method B: Transfer from local machine via SCP"
echo "  # On local machine:"
echo "  tar --exclude='.git' --exclude='*.db*' -czvf /tmp/nova.tar.gz ."
echo "  scp -i your-key.pem /tmp/nova.tar.gz ec2-user@<EC2_IP>:/tmp/"
echo "  # On EC2:"
echo "  sudo tar -xzvf /tmp/nova.tar.gz -C /opt/nova"
echo "  sudo chown -R nova:nova /opt/nova"
echo "  sudo -u nova /opt/nova/venv/bin/pip install -r /opt/nova/requirements.txt"
echo "================================================================================"
