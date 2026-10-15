#!/usr/bin/env bash
# ==============================================================================
# Safe SQLite Database Restoration Script
# Usage: sudo ./restore.sh [optional_path_to_backup.sqlite.gz]
# ==============================================================================

set -euo pipefail

BACKUP_SRC_DIR="/var/backups/cle-attendance"
ENV_FILE="/etc/cle-attendance/backend.env"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ "$(id -u)" -ne 0 ]; then
    echo "❌ [ERROR] This script must be run as root or with sudo."
    exit 1
fi

echo "=================================================================="
echo "          CLE SOCIETY - DATABASE RESTORATION UTILITY             "
echo "=================================================================="

# Source environment
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

DB_FILE="${DATABASE_PATH:-/var/lib/cle-attendance/database.sqlite}"
DB_DIR="$(dirname "$DB_FILE")"

# 1. Determine backup file
BACKUP_INPUT="${1:-}"

if [ -z "$BACKUP_INPUT" ]; then
    echo "No backup file path provided. Searching for newest backup in $BACKUP_SRC_DIR..."
    LATEST_BACKUP=$(find "$BACKUP_SRC_DIR" -type f \( -name "*.sqlite" -o -name "*.sqlite.gz" \) -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2- || true)
    if [ -z "$LATEST_BACKUP" ]; then
        echo "❌ [ERROR] No backups found in $BACKUP_SRC_DIR. Please specify an absolute backup path."
        exit 1
    fi
    BACKUP_INPUT="$LATEST_BACKUP"
fi

if [ ! -f "$BACKUP_INPUT" ]; then
    echo "❌ [ERROR] Specified backup file does not exist: $BACKUP_INPUT"
    exit 1
fi

echo "Selected backup source: $BACKUP_INPUT"
echo "Target database path:  $DB_FILE"

# Prepare uncompressed working file if input is gzipped
WORKING_BACKUP="$BACKUP_INPUT"
TEMP_DIR=""

if [[ "$BACKUP_INPUT" == *.gz ]]; then
    TEMP_DIR=$(mktemp -d)
    WORKING_BACKUP="${TEMP_DIR}/extracted_backup.sqlite"
    echo "Decompressing gzip archive to temporary working file..."
    gzip -dc "$BACKUP_INPUT" > "$WORKING_BACKUP"
fi

# 2. Validate backup integrity before stopping service
echo "Checking backup file integrity..."
if command -v sqlite3 >/dev/null 2>&1; then
    INTEGRITY=$(sqlite3 "$WORKING_BACKUP" "PRAGMA integrity_check;")
    if [ "$INTEGRITY" != "ok" ]; then
        echo "❌ [FATAL] Backup file integrity check failed: $INTEGRITY"
        [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
        exit 1
    fi
    USER_COUNT=$(sqlite3 "$WORKING_BACKUP" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
    ATTENDANCE_COUNT=$(sqlite3 "$WORKING_BACKUP" "SELECT COUNT(*) FROM attendance;" 2>/dev/null || echo "0")
    echo "✅ Backup verification passed (Users: $USER_COUNT, Attendance records: $ATTENDANCE_COUNT)"
fi

# 3. Stop backend service to prevent write conflicts during restoration
echo "Stopping cle-backend systemd service..."
systemctl stop cle-backend || true

# 4. Take emergency safety backup of current active database
if [ -f "$DB_FILE" ]; then
    EMERGENCY_BACKUP="${DB_FILE}.pre_restore_${TIMESTAMP}"
    echo "Taking emergency pre-restore snapshot of current database: $EMERGENCY_BACKUP"
    cp -p "$DB_FILE" "$EMERGENCY_BACKUP"
fi

# 5. Remove stale WAL and SHM files
WAL_FILE="${DB_FILE}-wal"
SHM_FILE="${DB_FILE}-shm"
[ -f "$WAL_FILE" ] && rm -f "$WAL_FILE" && echo "Removed stale WAL file."
[ -f "$SHM_FILE" ] && rm -f "$SHM_FILE" && echo "Removed stale SHM file."

# 6. Copy verified backup to active database location
mkdir -p "$DB_DIR"
cp -f "$WORKING_BACKUP" "$DB_FILE"

# 7. Apply proper ownership and security permissions
chown -R cleadmin:cleadmin "$DB_DIR"
chmod 750 "$DB_DIR"
chmod 640 "$DB_FILE"

# 8. Start backend service
echo "Restarting cle-backend service..."
systemctl start cle-backend

# 9. Clean up temporary uncompressed file
[ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"

# 10. Perform post-restoration health check
echo "Verifying backend service status..."
sleep 2
if systemctl is-active --quiet cle-backend; then
    echo "✅ cle-backend service is ACTIVE."
    if command -v curl >/dev/null 2>&1; then
        HEALTH=$(curl -s http://127.0.0.1:5001/api/health || echo "error")
        echo "Backend health check response: $HEALTH"
    fi
    echo "🎉 Database restoration completed successfully!"
else
    echo "❌ [ERROR] cle-backend failed to start after restoration. Check logs: journalctl -u cle-backend -n 50"
    exit 1
fi
