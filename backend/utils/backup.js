/**
 * Production Database Backup, Rotation & Disaster Recovery Engine
 * 
 * Provides:
 * 1. Online, transactionally consistent SQLite snapshots using better-sqlite3 native backup API.
 * 2. Automated backup rotation (preserves last 14 snapshots).
 * 3. Instant WAL checkpointing to flush write-ahead logs to permanent storage.
 * 4. Self-healing cold-start restore: if database file is wiped/missing on ephemeral hosting,
 *    automatically restores from the latest persistent snapshot.
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.resolve(__dirname, '../backups');
const PERSISTENT_SNAPSHOT_FILE = path.resolve(__dirname, '../data/production_snapshot.sqlite');
const MAX_BACKUPS_TO_KEEP = 14;

function ensureBackupDirectories() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const dataDir = path.dirname(PERSISTENT_SNAPSHOT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

/**
 * Perform a WAL checkpoint to commit pending transactions to primary database file
 */
function checkpointDatabase(db) {
    if (!db || !db.open) return;
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
        try {
            db.pragma('wal_checkpoint(PASSIVE)');
        } catch (e) {
            // Suppress if closed
        }
    }
}

/**
 * Creates an atomic, online, consistent SQLite backup
 */
async function createDatabaseBackup(db, label = 'auto') {
    if (!db || !db.open) {
        return null;
    }

    ensureBackupDirectories();

    // 1. Flush WAL first so all recent transactions are fully integrated
    checkpointDatabase(db);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${label}_${timestamp}.sqlite`;
    const targetPath = path.join(BACKUP_DIR, backupFileName);

    try {
        // Use better-sqlite3 native online backup API
        await db.backup(targetPath);

        // Also update the canonical recovery snapshot
        try {
            fs.copyFileSync(targetPath, PERSISTENT_SNAPSHOT_FILE);
        } catch (copyErr) {
            console.warn('[BACKUP] Could not update persistent recovery snapshot:', copyErr.message);
        }

        console.log(`[BACKUP SUCCESS] Created database backup: ${backupFileName} (${(fs.statSync(targetPath).size / 1024).toFixed(1)} KB)`);

        // Rotate old backups
        rotateOldBackups();

        return {
            filename: backupFileName,
            path: targetPath,
            size: fs.statSync(targetPath).size,
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        if (err.message && err.message.includes('not open')) {
            return null;
        }
        console.error('[BACKUP ERROR] Failed to create database backup:', err.message || err);
        return null;
    }
}

/**
 * Rotate old backup files, preserving up to MAX_BACKUPS_TO_KEEP
 */
function rotateOldBackups() {
    try {
        ensureBackupDirectories();
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && f.endsWith('.sqlite'))
            .map(f => ({
                name: f,
                fullPath: path.join(BACKUP_DIR, f),
                mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs
            }))
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length > MAX_BACKUPS_TO_KEEP) {
            const filesToRemove = files.slice(MAX_BACKUPS_TO_KEEP);
            for (const file of filesToRemove) {
                try {
                    fs.unlinkSync(file.fullPath);
                    console.log(`[BACKUP ROTATION] Pruned old backup: ${file.name}`);
                } catch (e) {}
            }
        }
    } catch (err) {
        console.warn('[BACKUP ROTATION] Error rotating backups:', err.message);
    }
}

/**
 * Check if the target database path is missing or empty, and restore from latest snapshot
 */
function restoreLatestBackupIfExists(targetDbPath) {
    try {
        ensureBackupDirectories();
        const targetExists = fs.existsSync(targetDbPath) && fs.statSync(targetDbPath).size > 0;
        if (targetExists) {
            return false; // Target database already exists and has data; do not overwrite
        }

        console.log(`[DISASTER RECOVERY] Target database missing or empty at: ${targetDbPath}`);

        let sourceSnapshot = null;
        if (fs.existsSync(PERSISTENT_SNAPSHOT_FILE) && fs.statSync(PERSISTENT_SNAPSHOT_FILE).size > 0) {
            sourceSnapshot = PERSISTENT_SNAPSHOT_FILE;
        } else {
            // Find most recent file in backups
            const backups = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.endsWith('.sqlite'))
                .map(f => path.join(BACKUP_DIR, f))
                .filter(p => fs.statSync(p).size > 0)
                .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

            if (backups.length > 0) {
                sourceSnapshot = backups[0];
            }
        }

        if (sourceSnapshot) {
            const targetDir = path.dirname(targetDbPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            fs.copyFileSync(sourceSnapshot, targetDbPath);
            console.log(`[DISASTER RECOVERY] Successfully auto-restored database from snapshot: ${sourceSnapshot} -> ${targetDbPath}`);
            return true;
        } else {
            console.log('[DISASTER RECOVERY] No existing snapshot found. Starting fresh schema initialization.');
            return false;
        }
    } catch (err) {
        console.error('[DISASTER RECOVERY ERROR] Auto-restore check encountered error:', err.message);
        return false;
    }
}

module.exports = {
    checkpointDatabase,
    createDatabaseBackup,
    rotateOldBackups,
    restoreLatestBackupIfExists,
    BACKUP_DIR,
    PERSISTENT_SNAPSHOT_FILE
};
