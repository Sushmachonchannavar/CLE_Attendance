#!/usr/bin/env bash
# ==============================================================================
# CLE Society Staff Attendance System - Production Deployment Script
# Usage: sudo ./deploy.sh
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "❌ [ERROR] This script must be run as root or with sudo."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="/etc/cle-attendance/backend.env"

echo "=================================================================="
echo "   CLE SOCIETY ATTENDANCE SYSTEM - PRODUCTION DEPLOYMENT RUNNER   "
echo "=================================================================="
echo "Deployment Root: $APP_ROOT"
echo "Timestamp:       $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# 1. Check for backend environment file
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ [ERROR] Production environment file not found: $ENV_FILE"
    echo "Please copy deploy/env/backend.env.production.example to $ENV_FILE"
    echo "and configure your real JWT_SECRET, SMS credentials, and DATABASE_PATH."
    exit 1
fi

# Ensure strict permissions on environment file
chmod 600 "$ENV_FILE"
chown cleadmin:cleadmin "$ENV_FILE"

# 2. Deploy Backend
echo "--> Step 1: Installing backend dependencies..."
cd "$APP_ROOT/backend"
npm ci --omit=dev

echo "--> Step 2: Running backend preflight deployment check..."
node scripts/preflight_check.js

echo "--> Step 3: Taking database online backup before migration..."
if [ -f "/var/lib/cle-attendance/database.sqlite" ]; then
    npm run db:backup || echo "⚠️ Pre-deploy backup warning: skipping if database not yet initialized."
fi

echo "--> Step 4: Applying deterministic database migrations..."
npm run migrate

# 3. Deploy Frontend
echo "--> Step 5: Building React + Vite frontend..."
cd "$APP_ROOT/frontend"
npm ci
npm run build

# 4. Set Ownership and Permissions
echo "--> Step 6: Setting directory ownership and permissions..."
chown -R cleadmin:cleadmin "$APP_ROOT"
chmod -R 755 "$APP_ROOT/frontend/dist"

# 5. Restart Backend Service
echo "--> Step 7: Restarting cle-backend service..."
systemctl restart cle-backend

echo "--> Step 8: Verifying backend health..."
sleep 3
if systemctl is-active --quiet cle-backend; then
    echo "✅ cle-backend service is ACTIVE."
    if command -v curl >/dev/null 2>&1; then
        HEALTH_CHECK=$(curl -s -f http://127.0.0.1:5001/api/health || echo "FAILED")
        echo "Backend health check response: $HEALTH_CHECK"
        if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
            echo "✅ Health check verified: backend is serving API requests."
        else
            echo "⚠️ Health check returned unexpected status. Inspect logs: journalctl -u cle-backend -n 30"
        fi
    fi
else
    echo "❌ [ERROR] cle-backend service failed to start! Checking journal logs:"
    journalctl -u cle-backend -n 25 --no-pager
    exit 1
fi

# 6. Reload Nginx
echo "--> Step 9: Testing and reloading Nginx..."
nginx -t
systemctl reload nginx
echo "✅ Nginx reloaded successfully."

echo "=================================================================="
echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "The application is live and accessible via HTTPS."
echo "=================================================================="
