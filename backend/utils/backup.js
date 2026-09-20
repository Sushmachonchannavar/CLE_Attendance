const fs = require('fs');
const path = require('path');
const db = require('../database');

/**
 * Creates an online, non-blocking backup of the SQLite database.
 * Supports running as a standalone CLI script or imported as a module.
 * 
 * @param {string} [customPath] - Optional specific destination file path
 * @returns {Promise<string>} The path to the created backup file
 */
async function performBackup(customPath) {
    const backupsDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = customPath || path.join(backupsDir, `backup_${timestamp}.sqlite`);

    console.log(`[BACKUP] Starting SQLite online backup to: ${backupFile}...`);

    await db.backup(backupFile);

    console.log(`[BACKUP] SQLite backup completed successfully: ${backupFile}`);
    return backupFile;
}

if (require.main === module) {
    performBackup()
        .then((file) => {
            console.log(`[BACKUP] Successfully created backup at: ${file}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('[BACKUP FATAL] Backup operation failed:', err.message || err);
            process.exit(1);
        });
}

module.exports = { performBackup };
