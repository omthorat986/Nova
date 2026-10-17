# 🚀 NOVA Space Observatory — Complete AWS Production Deployment Guide

A step-by-step, copy-paste friendly manual for provisioning, hardening, and running the **NOVA Space Observatory & Social Platform** on **Amazon Web Services (AWS)** using **EC2 (t3.micro)**, **S3**, **IAM**, **Nginx**, **Gunicorn**, **Certbot (HTTPS)**, and **CloudWatch Monitoring**.

---

## 📑 Table of Contents
1. [Prerequisites & Tools](#1-prerequisites--tools)
2. [IAM Root Security & Admin User Setup with MFA](#2-iam-root-security--admin-user-setup-with-mfa)
3. [Zero-Spend AWS Budget Alert (Safety First)](#3-zero-spend-aws-budget-alert-safety-first)
4. [Amazon S3 Private Storage Bucket Setup](#4-amazon-s3-private-storage-bucket-setup)
5. [IAM Role & Least-Privilege Policies for EC2](#5-iam-role--least-privilege-policies-for-ec2)
6. [Security Group Configuration](#6-security-group-configuration)
7. [EC2 Instance Launch (t3.micro, IMDSv2, gp3)](#7-ec2-instance-launch-t3micro-imdsv2-gp3)
8. [Elastic IP Allocation & Association](#8-elastic-ip-allocation--association)
9. [DNS & Free Domain Setup (DuckDNS)](#9-dns--free-domain-setup-duckdns)
10. [Server Bootstrap & Hardening](#10-server-bootstrap--hardening)
11. [Codebase Deployment & Permissions](#11-codebase-deployment--permissions)
12. [Environment Configuration (/etc/nova/nova.env)](#12-environment-configuration-etcnovanovaenv)
13. [Database Migrations & Initial Curator Creation](#13-database-migrations--initial-curator-creation)
14. [Starting the Systemd Service Daemon](#14-starting-the-systemd-service-daemon)
15. [Nginx Reverse Proxy & Certbot TLS/HTTPS](#15-nginx-reverse-proxy--certbot-tlshttps)
16. [CloudWatch Agent, Telemetry & Alarms](#16-cloudwatch-agent-telemetry--alarms)
17. [Smoke Testing & Live Evidence Verification](#17-smoke-testing--live-evidence-verification)
18. [Automated Backups & Disaster Recovery](#18-automated-backups--disaster-recovery)
19. [Zero-Downtime Releases & Instant Rollback](#19-zero-downtime-releases--instant-rollback)
20. [Troubleshooting Guide (502, AccessDenied, 413, SSL)](#20-troubleshooting-guide)
21. [Cost Estimation & Complete Teardown Guide](#21-cost-estimation--complete-teardown-guide)

---

## 1. Prerequisites & Tools

Ensure you have installed on your local computer:
- **AWS CLI v2** configured with your credentials (`aws configure`).
- **OpenSSH Client** (`ssh`).
- A modern web browser.
- An active AWS Account (eligible for the AWS 12-Month Free Tier).

```bash
# Verify AWS CLI installation
aws --version
```

---

## 2. IAM Root Security & Admin User Setup with MFA

### Step 2.1: Lock the Root Account
1. Log in to the AWS Console as the **Root User**.
2. Navigate to **IAM** -> **Security Credentials**.
3. Under **Multi-factor authentication (MFA)**, click **Assign MFA device**.
4. Name the device `Root-Authenticator` and scan the QR code using Google Authenticator, 1Password, or Authy.
5. Enter two consecutive 6-digit codes and click **Add MFA**.
6. Under **Access keys**, ensure **zero active access keys** exist for the root account.

### Step 2.2: Create Dedicated Admin User
1. In the IAM console, click **Users** -> **Create user**.
2. Username: `nova-admin`.
3. Check **Provide user access to the AWS Management Console**.
4. Set a custom password (min 16 characters).
5. On the **Set permissions** screen, select **Attach policies directly** and select `AdministratorAccess`.
6. Click **Create user**.
7. Log out of root and log back in as `nova-admin`. Immediately assign an MFA device to `nova-admin`.

---

## 3. Zero-Spend AWS Budget Alert (Safety First)

Set up a budget alert **before** launching any resources to avoid unexpected charges:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

cat > /tmp/budget.json <<EOF
{
  "BudgetLimit": {
    "Amount": "1.00",
    "Unit": "USD"
  },
  "BudgetName": "Nova-FreeTier-Protection",
  "BudgetType": "COST",
  "TimeUnit": "MONTHLY"
}
EOF

cat > /tmp/notifications.json <<EOF
[
  {
    "Notification": {
      "ComparisonOperator": "GREATER_THAN",
      "NotificationType": "ACTUAL",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "Address": "your-email@example.com",
        "SubscriptionType": "EMAIL"
      }
    ]
  }
]
EOF

aws budgets create-budget \
    --account-id "${ACCOUNT_ID}" \
    --budget file:///tmp/budget.json \
    --notifications-with-subscribers file:///tmp/notifications.json
rm -f /tmp/budget.json /tmp/notifications.json
```

---

## 4. Amazon S3 Private Storage Bucket Setup

Create a dedicated private S3 bucket with **Block Public Access**, **Default Server-Side Encryption (SSE-S3)**, and **Object Versioning**.

```bash
export AWS_REGION="us-east-1"
export BUCKET_NAME="nova-observatory-prod-${ACCOUNT_ID}"

# 1. Create Bucket
aws s3api create-bucket \
    --bucket "${BUCKET_NAME}" \
    --region "${AWS_REGION}"

# 2. Enforce Block Public Access (All 4 settings ON)
aws s3api put-public-access-block \
    --bucket "${BUCKET_NAME}" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 3. Enable Default SSE-S3 Encryption (AES256)
aws s3api put-bucket-encryption \
    --bucket "${BUCKET_NAME}" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'

# 4. Enable Object Versioning
aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled

# 5. Apply Lifecycle Configuration (Clean old versions & incomplete multiparts)
aws s3api put-bucket-lifecycle-configuration \
    --bucket "${BUCKET_NAME}" \
    --lifecycle-configuration file://deploy/s3-lifecycle-configuration.json
```

---

## 5. IAM Role & Least-Privilege Policies for EC2

Create the EC2 instance role and attach least-privilege policies scoped exclusively to the required S3 prefixes (`uploads/`, `avatars/`, `banners/`, `agencies/`, `outreach/`, `backups/`) and CloudWatch log groups.

```bash
# 1. Create IAM Role with EC2 Trust Policy
aws iam create-role \
    --role-name NovaEC2ServerRole \
    --assume-role-policy-document file://deploy/trust-policy-ec2.json

# 2. Inject your actual bucket name into the policy and put it
sed "s/YOUR_BUCKET_NAME/${BUCKET_NAME}/g; s/YOUR_ACCOUNT_ID/${ACCOUNT_ID}/g" \
    deploy/iam-policy-ec2-role.json > /tmp/resolved-iam-policy.json

aws iam put-role-policy \
    --role-name NovaEC2ServerRole \
    --policy-name NovaScopedAccessPolicy \
    --policy-document file:///tmp/resolved-iam-policy.json
rm -f /tmp/resolved-iam-policy.json

# 3. Create Instance Profile & Attach Role
aws iam create-instance-profile --instance-profile-name NovaEC2InstanceProfile || true
aws iam add-role-to-instance-profile \
    --instance-profile-name NovaEC2InstanceProfile \
    --role-name NovaEC2ServerRole || true

# 4. Attach Bucket Policy enforcing TLS & granting EC2 role access
sed "s/YOUR_BUCKET_NAME/${BUCKET_NAME}/g; s/YOUR_ACCOUNT_ID/${ACCOUNT_ID}/g" \
    deploy/s3-bucket-policy.json > /tmp/resolved-bucket-policy.json

aws s3api put-bucket-policy \
    --bucket "${BUCKET_NAME}" \
    --policy file:///tmp/resolved-bucket-policy.json
rm -f /tmp/resolved-bucket-policy.json
```

---

## 6. Security Group Configuration

Create an EC2 Security Group permitting:
- **Port 80 (HTTP)**: Open to 0.0.0.0/0 (required for Let's Encrypt validation & redirect).
- **Port 443 (HTTPS)**: Open to 0.0.0.0/0 (production web traffic).
- **Port 22 (SSH)**: **Restricted exclusively to your current public IP**.

```bash
# Get your current public IP address
MY_IP=$(curl -s https://checkip.amazonaws.com)

# 1. Create Security Group
SG_ID=$(aws ec2 create-security-group \
    --group-name "nova-web-sg" \
    --description "NOVA Observatory Web Security Group" \
    --query "GroupId" --output text)

# 2. Allow HTTPS (443) and HTTP (80)
aws ec2 authorize-security-group-ingress --group-id "${SG_ID}" --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "${SG_ID}" --protocol tcp --port 443 --cidr 0.0.0.0/0

# 3. Allow SSH (22) from your IP only
aws ec2 authorize-security-group-ingress --group-id "${SG_ID}" --protocol tcp --port 22 --cidr "${MY_IP}/32"

echo "Security Group created: ${SG_ID} (SSH locked to ${MY_IP}/32)"
```

---

## 7. EC2 Instance Launch (t3.micro, IMDSv2, gp3)

Launch an **Ubuntu 24.04 LTS** instance on a `t3.micro` shape, mandating **IMDSv2** (neutralizing SSRF risks) and using an encrypted **gp3** root disk:

```bash
# 1. Create SSH Key Pair (if you don't already have one)
aws ec2 create-key-pair \
    --key-name nova-deploy-key \
    --query 'KeyMaterial' \
    --output text > ~/.ssh/nova-deploy-key.pem
chmod 400 ~/.ssh/nova-deploy-key.pem

# 2. Find latest Ubuntu 24.04 LTS AMI ID
UBUNTU_AMI=$(aws ssm get-parameters \
    --names /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
    --query "Parameters[0].Value" --output text)

# 3. Launch Instance with IMDSv2 Required
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "${UBUNTU_AMI}" \
    --instance-type t3.micro \
    --key-name nova-deploy-key \
    --security-group-ids "${SG_ID}" \
    --iam-instance-profile Name=NovaEC2InstanceProfile \
    --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3","Encrypted":true,"DeleteOnTermination":true}}]' \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=nova-observatory-prod}]' \
    --query "Instances[0].InstanceId" --output text)

echo "Waiting for instance ${INSTANCE_ID} to reach running state..."
aws ec2 wait instance-running --instance-ids "${INSTANCE_ID}"
```

---

## 8. Elastic IP Allocation & Association

Allocate an **Elastic IP** (static IPv4) and attach it to your EC2 instance so its IP remains constant across restarts:

```bash
# Allocate Elastic IP
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query "AllocationId" --output text)
PUBLIC_IP=$(aws ec2 describe-addresses --allocation-ids "${EIP_ALLOC}" --query "Addresses[0].PublicIp" --output text)

# Associate with Instance
aws ec2 associate-address --instance-id "${INSTANCE_ID}" --allocation-id "${EIP_ALLOC}"

echo "Static Elastic IP: ${PUBLIC_IP}"
```

---

## 9. DNS & Free Domain Setup (DuckDNS)

1. Navigate to **[DuckDNS.org](https://www.duckdns.org/)** and log in with GitHub/Google.
2. Under **domains**, choose a subdomain (e.g., `nova-observatory`).
3. Set the **IP** address to your EC2 Elastic IP: `${PUBLIC_IP}`.
4. Click **update ip**.
5. Your public domain is now: `nova-observatory.duckdns.org`.

```bash
# Test DNS propagation
nslookup nova-observatory.duckdns.org
```

---

## 10. Server Bootstrap & Hardening

Connect to your EC2 instance via SSH and run the automated bootstrap script:

```bash
# SSH into EC2 instance
ssh -i ~/.ssh/nova-deploy-key.pem ubuntu@${PUBLIC_IP}
```

Once logged into EC2:
```bash
# Clone or copy the bootstrap script and execute
git clone https://github.com/your-username/website.git /tmp/website-bootstrap
cd /tmp/website-bootstrap

sudo bash deploy/scripts/bootstrap-ec2.sh
```

The bootstrap script automatically:
- Detects the OS (Amazon Linux 2023 or Ubuntu) and pins Python >= 3.11 (`python3.11` on AL2023).
- Installs Nginx, Python 3.11+, pip, venv, SQLite3, Certbot.
- Allocates a 1 GB swap file (preventing memory pressure on t3.micro).
- Enables automatic security updates.
- Creates system user `nova` and base directory `/opt/nova` (`chmod 750`).
- Initializes a dedicated virtual environment at `/opt/nova/venv`.
- Installs the AWS CloudWatch Agent.

---

## 11. Codebase Deployment & Permissions

Choose one of two methods to get the application code onto EC2 at `/opt/nova`:

### Method A: Git Clone to `/opt/nova` (Recommended)
```bash
# Clone the deploy-ready branch into /opt/nova
sudo git clone -b deploy-ready https://github.com/YOUR_USER/YOUR_REPO.git /opt/nova

# Set ownership and permissions
sudo chown -R nova:nova /opt/nova
sudo chmod 750 /opt/nova

# Install Python production dependencies into the virtualenv
sudo -u nova /opt/nova/venv/bin/pip install --upgrade pip
sudo -u nova /opt/nova/venv/bin/pip install -r /opt/nova/requirements.txt
```

### Method B: Tarball Transfer via SCP
```bash
# On your local computer:
tar --exclude='.git' --exclude='*.db*' -czvf /tmp/nova-deploy.tar.gz .
scp -i ~/.ssh/nova-deploy-key.pem /tmp/nova-deploy.tar.gz ubuntu@${PUBLIC_IP}:/tmp/

# On the EC2 instance:
sudo tar -xzvf /tmp/nova-deploy.tar.gz -C /opt/nova
sudo chown -R nova:nova /opt/nova
sudo chmod 750 /opt/nova
sudo -u nova /opt/nova/venv/bin/pip install --upgrade pip
sudo -u nova /opt/nova/venv/bin/pip install -r /opt/nova/requirements.txt
```

---

## 12. Environment Configuration (`/etc/nova/nova.env`)

Configure the production environment securely in `/etc/nova/nova.env` (restricted to `chmod 600`):

```bash
sudo bash -c 'cat > /etc/nova/nova.env' <<EOF
APP_ENV=production
ENV=production
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
STORAGE_MODE=s3
S3_BUCKET=your-actual-bucket-name
AWS_REGION=us-east-1
S3_URL_EXPIRATION_SECONDS=300
NOVA_DB_PATH=/opt/nova/data/nova.db
ALLOWED_HOSTS=nova-observatory.duckdns.org,localhost,127.0.0.1
SESSION_COOKIE_SECURE=true
SESSION_IDLE_TIMEOUT_MINUTES=30
SESSION_ABSOLUTE_TIMEOUT_HOURS=12
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15
UPLOAD_RATE_LIMIT_HOURLY=5
NASA_API_KEY=DEMO_KEY
EMAIL_MODE=local
LOG_LEVEL=INFO
GUNICORN_BIND=127.0.0.1:8080
GUNICORN_WORKERS=2
EOF

sudo chmod 600 /etc/nova/nova.env
sudo chown nova:nova /etc/nova/nova.env
```

---

## 13. Database Migrations & Initial Curator Creation

Initialize the clean production database schema, seed official space agency channels, and create the initial curator:

```bash
cd /opt/nova

# 1. Run migrations & agency seeds
sudo -u nova /opt/nova/venv/bin/python manage.py migrate
sudo -u nova /opt/nova/venv/bin/python manage.py seed

# 2. Interactively create the first curator account (prompts securely for password)
sudo -u nova /opt/nova/venv/bin/python manage.py create-curator
```

---

## 14. Starting the Systemd Service Daemon

Install and start the hardened `nova.service` systemd unit:

```bash
# Copy systemd unit file
sudo cp /opt/nova/deploy/nova.service /etc/systemd/system/nova.service
sudo systemctl daemon-reload

# Enable on boot and start service
sudo systemctl enable --now nova.service

# Check service status
sudo systemctl status nova.service
```

---

## 15. Working HTTPS Bootstrap Order & Nginx Configuration

To avoid the chicken-and-egg bootstrap issue where Nginx refuses to start without certificate files, obtain the certificate with Certbot's standalone server **before** enabling Nginx:

```bash
# 1. Acquire Let's Encrypt certificate via Certbot standalone (while port 80 is open)
sudo certbot certonly --standalone \
    -d nova-observatory.duckdns.org \
    --non-interactive --agree-tos \
    -m your-email@example.com

# 2. Replace placeholder domain with your DuckDNS domain in nginx.conf
sudo sed -i 's/YOUR_DOMAIN.duckdns.org/nova-observatory.duckdns.org/g' /opt/nova/deploy/nginx.conf

# 3. Link configuration to Nginx sites-enabled
sudo cp /opt/nova/deploy/nginx.conf /etc/nginx/sites-available/nova.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/nova.conf /etc/nginx/sites-enabled/nova.conf

# 4. Test Nginx syntax (validates successfully because certificate files exist!)
sudo nginx -t

# 5. Enable and start Nginx
sudo systemctl enable --now nginx
```

---

## 16. CloudWatch Agent, Telemetry & Alarms

Configure the CloudWatch agent to ship rotating logs and stream OS metrics:

```bash
# 1. Start CloudWatch Agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/nova/deploy/cloudwatch-agent-config.json \
    -s

# 2. Create SNS Alerting Topic for Alarms
SNS_TOPIC_ARN=$(aws sns create-topic --name nova-alerts-topic --query "TopicArn" --output text)
aws sns subscribe \
    --topic-arn "${SNS_TOPIC_ARN}" \
    --protocol email \
    --notification-endpoint your-email@example.com

# 3. Create CloudWatch Metric Alarm for High CPU
aws cloudwatch put-metric-alarm \
    --alarm-name "Nova-EC2-HighCPU" \
    --alarm-description "Triggers if CPU > 70% for 2 minutes" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 60 \
    --threshold 70 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=InstanceId,Value="${INSTANCE_ID}" \
    --evaluation-periods 2 \
    --alarm-actions "${SNS_TOPIC_ARN}"

# 4. Create CloudWatch Metric Alarm for Status Check Failures
aws cloudwatch put-metric-alarm \
    --alarm-name "Nova-EC2-StatusCheckFailed" \
    --metric-name StatusCheckFailed \
    --namespace AWS/EC2 \
    --statistic Maximum \
    --period 60 \
    --threshold 0 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=InstanceId,Value="${INSTANCE_ID}" \
    --evaluation-periods 1 \
    --alarm-actions "${SNS_TOPIC_ARN}"
```

---

## 17. Smoke Testing & Live Evidence Verification

Run the automated smoke test suite against your live HTTPS domain:

```bash
# Run smoke test suite
bash deploy/scripts/smoke-test.sh https://nova-observatory.duckdns.org
```

Expected output:
```plaintext
================================================================================
📊 NOVA PRODUCTION DEPLOYMENT SMOKE TEST EVIDENCE
================================================================================
| STATUS   | VERIFICATION CHECK                     | TELEMETRY DETAILS        |
|:---------|:---------------------------------------|:-------------------------|
| [PASS]   | Liveness Probe (/health)               | HTTP 200 with status=ok  |
| [PASS]   | Readiness Probe (/ready)               | HTTP 200 database online |
| [PASS]   | HTTP to HTTPS 301 Redirect             | Port 80 redirect enforced|
| [PASS]   | HSTS Header Enforced                   | max-age header present   |
| [PASS]   | X-Content-Type-Options Header          | nosniff present          |
| [PASS]   | X-Frame-Options Header                 | DENY present             |
| [PASS]   | Content-Security-Policy                | CSP active               |
| [PASS]   | Server Banner Suppression              | No version leaked        |
| [PASS]   | Direct S3 Public Access Blocked        | HTTP 403 AccessDenied    |
| [PASS]   | Public Routes Availability             | All core endpoints 200   |
================================================================================
🎉 ALL SMOKE TESTS PASSED! Production system is fully operational.
```

---

## 18. Automated Backups & Disaster Recovery

Set up automated daily backups and hourly housekeeping in cron:

```bash
# Add cron entries for user 'nova'
sudo -u nova crontab -l 2>/dev/null | { cat; echo "0 2 * * * /bin/bash /opt/nova/deploy/scripts/backup.sh >> /opt/nova/logs/backup.log 2>&1"; } | sudo -u nova crontab -
sudo -u nova crontab -l 2>/dev/null | { cat; echo "0 * * * * /bin/bash /opt/nova/deploy/scripts/housekeeping.sh >> /opt/nova/logs/housekeeping.log 2>&1"; } | sudo -u nova crontab -
```

To restore the database from an S3 backup at any time:
```bash
sudo bash /opt/nova/deploy/scripts/restore.sh
```

---

## 19. Multi-Worker Rate Limiting & Concurrency Architecture

### Storage & Concurrency Model
1. **In-Memory Sliding Window**: The application's `SlidingWindowLimiter` in `server.py` tracks rate limits (5 failed logins per 15 min, 5 avatar uploads per hour) in memory with thread locks.
2. **Two Gunicorn Workers**: Because Gunicorn runs with 2 worker processes on t3.micro, in-memory counters are maintained **per-worker process**. An attacker distributing requests across both worker processes could theoretically make up to 10 failed login attempts before both workers independently engage lockout.
3. **Nginx Edge Rate Limiting (Layer 1 Defense)**: Nginx acts as the unified gatekeeper in `deploy/nginx.conf`:
   - `zone=auth_zone:10m rate=5r/m;` strictly caps authentication requests across all workers.
   - `zone=api_zone:10m rate=15r/s;` throttles API requests globally before they reach Gunicorn.
4. **Horizontal Scaling Path**: If scaling beyond a single EC2 instance, rate limiting state should be centralized in an Amazon ElastiCache (Redis) cluster or an SQLite-backed token table.

---

## 20. Troubleshooting Guide

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **HTTP 502 Bad Gateway** | Gunicorn process is down or socket permissions incorrect | Run `sudo systemctl status nova` and inspect `sudo journalctl -u nova -n 50`. Check that `127.0.0.1:8080` is listening. |
| **S3 AccessDenied (403)** | IAM Role not attached to EC2 or S3 bucket policy mismatched | Run `aws sts get-caller-identity` from EC2 to confirm role assumption. Verify S3 bucket policy allows `NovaEC2ServerRole`. |
| **HTTP 413 Payload Too Large** | Upload exceeds Nginx or Gunicorn buffer limit | Confirm `client_max_body_size 6M;` in Nginx and `MAX_CONTENT_LENGTH = 5*1024*1024` in `server.py`. |
| **Mixed Content Warning** | Browser loading assets over HTTP instead of HTTPS | Ensure `ProxyFix` is active in `server.py` and Nginx sends `X-Forwarded-Proto https;`. |
| **Certbot Renewal Failure** | Port 80 closed in Security Group or ACME challenge blocked | Verify port 80 is open to 0.0.0.0/0 in AWS Security Group. Test renewal with `sudo certbot renew --dry-run`. |
| **Permission Denied in Logs** | Systemd user `nova` cannot write to `/var/www/nova/shared` | Run `sudo chown -R nova:nova /var/www/nova` and ensure `chmod 750` on directories. |

---

## 21. Cost Estimation & Complete Teardown Guide

### Monthly Cost Estimation (AWS Free Tier)
- **EC2 (t3.micro)**: 750 hours/month Free Tier eligible (**$0.00**).
- **EBS (gp3 20 GB)**: 30 GB/month Free Tier eligible (**$0.00**).
- **Elastic IP**: Free while attached to a running instance (**$0.00**).
- **Amazon S3**: 5 GB standard storage + 20,000 GETs Free Tier eligible (**$0.00**).
- **CloudWatch**: 10 custom metrics + 3 alarms + 5 GB log ingestion Free Tier (**$0.00**).
- **Total Expected Monthly Cost**: **$0.00 / month** on Free Tier (approx $10-$15/month afterwards).

### Complete Teardown (Zero Lingering Charges)
To permanently terminate all cloud infrastructure and guarantee zero charges remain:

```bash
# 1. Terminate EC2 Instance
aws ec2 terminate-instances --instance-ids "${INSTANCE_ID}"
aws ec2 wait instance-terminated --instance-ids "${INSTANCE_ID}"

# 2. Release Elastic IP
aws ec2 release-address --allocation-id "${EIP_ALLOC}"

# 3. Delete Security Group
aws ec2 delete-security-group --group-id "${SG_ID}"

# 4. Empty and Delete S3 Bucket (including all object versions)
aws s3 rm "s3://${BUCKET_NAME}" --recursive
aws s3api delete-bucket --bucket "${BUCKET_NAME}" --region "${AWS_REGION}"

# 5. Delete CloudWatch Alarms and Log Groups
aws cloudwatch delete-alarms --alarm-names "Nova-EC2-HighCPU" "Nova-EC2-StatusCheckFailed"
aws logs delete-log-group --log-group-name "/nova/app" || true
aws logs delete-log-group --log-group-name "/nova/access" || true
aws logs delete-log-group --log-group-name "/nova/audit" || true
aws logs delete-log-group --log-group-name "/nova/nginx/access" || true
aws logs delete-log-group --log-group-name "/nova/nginx/error" || true

# 6. Delete SNS Topic & IAM Roles
aws sns delete-topic --topic-arn "${SNS_TOPIC_ARN}"
aws iam remove-role-from-instance-profile --instance-profile-name NovaEC2InstanceProfile --role-name NovaEC2ServerRole
aws iam delete-instance-profile --instance-profile-name NovaEC2InstanceProfile
aws iam delete-role-policy --role-name NovaEC2ServerRole --policy-name NovaScopedAccessPolicy
aws iam delete-role --role-name NovaEC2ServerRole
```
