#!/usr/bin/env bash
# ==============================================================================
# Automated SQLite Online Backup Script with Retention
# Run via cron (e.g. daily at 2:00 AM)
# Crontab: 0 2 * * * /var/www/cle-attendance/deploy/scripts/backup.sh >> /var/log/cle-backup.log 2>&1
# ==============================================================================

set -euo pipefail

BACKUP_DEST_DIR="/var/backups/cle-attendance"
APP_DIR="/var/www/cle-attendance/backend"
ENV_FILE="/etc/cle-attendance/backend.env"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=14

mkdir -p "$BACKUP_DEST_DIR"
chmod 700 "$BACKUP_DEST_DIR"

echo "=================================================================="
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting Automated CLE SQLite Backup"
echo "=================================================================="

# Export environment variables if backend.env exists
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

DB_FILE="${DATABASE_PATH:-/var/lib/cle-attendance/database.sqlite}"
RAW_BACKUP_FILE="${BACKUP_DEST_DIR}/cle_backup_${TIMESTAMP}.sqlite"
GZ_BACKUP_FILE="${RAW_BACKUP_FILE}.gz"

if [ ! -f "$DB_FILE" ]; then
    echo "❌ [ERROR] Database file not found at: $DB_FILE"
    exit 1
fi

echo "Active database path: $DB_FILE"
echo "Target backup path: $RAW_BACKUP_FILE"

# Use better-sqlite3 online backup or sqlite3 .backup
if command -v node >/dev/null 2>&1 && [ -d "$APP_DIR" ]; then
    echo "Running online non-blocking backup via better-sqlite3..."
    cd "$APP_DIR"
    node -e "const { performBackup } = require('./utils/backup'); performBackup(process.argv[1]).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })" "$RAW_BACKUP_FILE"
elif command -v sqlite3 >/dev/null 2>&1; then
    echo "Running online backup via sqlite3 CLI .backup..."
    sqlite3 "$DB_FILE" ".backup '$RAW_BACKUP_FILE'"
else
    echo "❌ [ERROR] Neither node nor sqlite3 CLI found to perform online backup."
    exit 1
fi

# Verify backup integrity
if command -v sqlite3 >/dev/null 2>&1; then
    INTEGRITY=$(sqlite3 "$RAW_BACKUP_FILE" "PRAGMA integrity_check;")
    if [ "$INTEGRITY" != "ok" ]; then
        echo "❌ [FATAL] Backup integrity check failed: $INTEGRITY"
        rm -f "$RAW_BACKUP_FILE"
        exit 1
    fi
    echo "✅ SQLite integrity verification: ok"
fi

# Compress the backup file to conserve disk space
gzip -f -9 "$RAW_BACKUP_FILE"
echo "✅ Compressed backup created: $GZ_BACKUP_FILE ($(du -h "$GZ_BACKUP_FILE" | cut -f1))"

# Prune old backups older than RETENTION_DAYS
echo "Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DEST_DIR" -type f -name "cle_backup_*.sqlite.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} +
echo "✅ Backup retention maintenance complete."
echo "Backup process finished successfully at $(date -u +"%Y-%m-%dT%H:%M:%SZ")."
