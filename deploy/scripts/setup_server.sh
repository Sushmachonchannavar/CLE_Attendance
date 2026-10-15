#!/usr/bin/env bash
# ==============================================================================
# CLE Society Staff Attendance System - Ubuntu Server Initialization Script
# Usage: sudo ./setup_server.sh
# Supports: Ubuntu 22.04 LTS / 24.04 LTS
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "❌ [ERROR] This script must be run as root or with sudo."
    exit 1
fi

echo "=================================================================="
echo "   CLE SOCIETY ATTENDANCE SYSTEM - SERVER INITIALIZATION SETUP   "
echo "=================================================================="

# 1. System Updates
echo "--> Updating system packages..."
apt-get update -y
apt-get install -y curl git ufw nginx sqlite3 certbot python3-certbot-nginx build-essential python3

# 2. Install Node.js 20 LTS (if not already installed or older than 18)
NEED_NODE=true
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "✅ Node.js v$(node -v) is already installed."
        NEED_NODE=false
    fi
fi

if [ "$NEED_NODE" = true ]; then
    echo "--> Installing Node.js 20 LTS via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "✅ Node.js $(node -v) and npm $(npm -v) installed."
fi

# 3. Create Dedicated Non-Root System User: cleadmin
if id "cleadmin" &>/dev/null; then
    echo "✅ System user 'cleadmin' already exists."
else
    echo "--> Creating dedicated service account 'cleadmin'..."
    useradd --system --shell /bin/false --no-create-home cleadmin
    echo "✅ User 'cleadmin' created."
fi

# 4. Create Persistent Storage Directories
echo "--> Creating persistent database, uploads, and backup directories..."
mkdir -p /var/lib/cle-attendance/uploads/od-documents
mkdir -p /var/backups/cle-attendance
mkdir -p /etc/cle-attendance
mkdir -p /var/www/cle-attendance
mkdir -p /var/www/certbot

# Set proper ownership and permissions
chown -R cleadmin:cleadmin /var/lib/cle-attendance
chmod 750 /var/lib/cle-attendance
chmod 750 /var/lib/cle-attendance/uploads

chown -R root:root /var/backups/cle-attendance
chmod 700 /var/backups/cle-attendance

chown -R root:cleadmin /etc/cle-attendance
chmod 750 /etc/cle-attendance

chown -R cleadmin:cleadmin /var/www/cle-attendance
chmod 755 /var/www/cle-attendance

# 5. Configure Firewall (UFW)
echo "--> Configuring UFW firewall rules..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
# Ensure port 5001 is NOT exposed to public
ufw delete allow 5001/tcp 2>/dev/null || true
echo "y" | ufw enable
echo "✅ Firewall enabled. Ports 22, 80, and 443 allowed."

# 6. Install Systemd Service Unit
echo "--> Installing systemd service unit..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$PROJECT_ROOT/deploy/systemd/cle-backend.service" ]; then
    cp -f "$PROJECT_ROOT/deploy/systemd/cle-backend.service" /etc/systemd/system/cle-backend.service
    systemctl daemon-reload
    systemctl enable cle-backend
    echo "✅ cle-backend.service installed and enabled."
fi

# 7. Configure Automated Daily Backup Cron Job
echo "--> Configuring daily automated backup cron job..."
CRON_JOB="0 2 * * * /var/www/cle-attendance/deploy/scripts/backup.sh >> /var/log/cle-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "cle-attendance/deploy/scripts/backup.sh" ; echo "$CRON_JOB") | crontab -
echo "✅ Daily backup scheduled at 2:00 AM."

echo "=================================================================="
echo "🎉 Server initialization complete!"
echo "Next Steps:"
echo "1. Copy production environment file to: /etc/cle-attendance/backend.env"
echo "   chmod 600 /etc/cle-attendance/backend.env"
echo "   chown cleadmin:cleadmin /etc/cle-attendance/backend.env"
echo "2. Run deployment script: sudo ./deploy.sh"
echo "3. Issue SSL certificate: certbot --nginx -d attendance.yourdomain.com"
echo "=================================================================="
