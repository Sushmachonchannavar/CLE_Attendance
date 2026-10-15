#!/usr/bin/env node
/**
 * Safe SQLite Database Restoration Script
 * Safely restores an online SQLite backup with integrity verification,
 * pre-restore emergency backup, and WAL/SHM cleanup.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function getDatabasePath() {
    const configuredPath = process.env.DATABASE_PATH || process.env.DB_FILE;
    if (configuredPath && typeof configuredPath === 'string' && configuredPath.trim() !== '') {
        const trimmed = configuredPath.trim();
        return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(__dirname, '..', trimmed);
    }
    return path.resolve(__dirname, '../database.sqlite');
}

/**
 * Validates whether a file has a valid SQLite header and passes integrity check
 */
function validateBackupFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file does not exist: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size < 100) {
        throw new Error(`Backup file is suspiciously small (${stat.size} bytes): ${filePath}`);
    }

    // Verify SQLite magic header (first 16 bytes: "SQLite format 3\0")
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf8', 0, 15);
    if (header !== 'SQLite format 3') {
        throw new Error(`File is not a valid SQLite database (header mismatch): ${filePath}`);
    }

    // Run PRAGMA integrity_check
    const testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    try {
        const result = testDb.pragma('integrity_check');
        if (!result || !result[0] || result[0].integrity_check !== 'ok') {
            throw new Error(`Integrity check failed: ${JSON.stringify(result)}`);
        }
    } finally {
        testDb.close();
    }

    return true;
}

/**
 * Performs safe restoration of database from backup
 */
async function performRestore(backupFilePath) {
    const targetDbPath = getDatabasePath();
    const backupsDir = path.resolve(__dirname, '../backups');

    let resolvedBackupPath = backupFilePath;

    // If no path is specified, locate the newest backup in backups directory
    if (!resolvedBackupPath) {
        if (!fs.existsSync(backupsDir)) {
            throw new Error(`Backups directory not found: ${backupsDir}`);
        }
        const files = fs.readdirSync(backupsDir)
            .filter(f => f.endsWith('.sqlite'))
            .map(f => ({ name: f, path: path.join(backupsDir, f), mtime: fs.statSync(path.join(backupsDir, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length === 0) {
            throw new Error(`No SQLite backup files found in: ${backupsDir}`);
        }

        resolvedBackupPath = files[0].path;
        console.log(`[RESTORE] No backup file specified. Using most recent backup: ${files[0].name}`);
    }

    resolvedBackupPath = path.isAbsolute(resolvedBackupPath) ? resolvedBackupPath : path.resolve(process.cwd(), resolvedBackupPath);

    console.log(`[RESTORE] Validating backup integrity: ${resolvedBackupPath}...`);
    validateBackupFile(resolvedBackupPath);
    console.log(`[RESTORE] Backup validation passed (SQLite format 3, PRAGMA integrity_check: ok)`);

    // Pre-restore safety backup of active database
    if (fs.existsSync(targetDbPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const preRestoreBackup = `${targetDbPath}.pre_restore_${timestamp}`;
        console.log(`[RESTORE] Taking safety copy of current active database: ${preRestoreBackup}...`);
        fs.copyFileSync(targetDbPath, preRestoreBackup);
    }

    // Clean up active WAL & SHM files before replacing the main DB file
    const walFile = `${targetDbPath}-wal`;
    const shmFile = `${targetDbPath}-shm`;

    if (fs.existsSync(walFile)) {
        console.log(`[RESTORE] Removing stale WAL file: ${walFile}`);
        try { fs.unlinkSync(walFile); } catch (e) { console.warn(`Could not remove ${walFile}: ${e.message}`); }
    }
    if (fs.existsSync(shmFile)) {
        console.log(`[RESTORE] Removing stale SHM file: ${shmFile}`);
        try { fs.unlinkSync(shmFile); } catch (e) { console.warn(`Could not remove ${shmFile}: ${e.message}`); }
    }

    // Copy backup to target destination
    console.log(`[RESTORE] Copying verified backup to target database: ${targetDbPath}...`);
    fs.copyFileSync(resolvedBackupPath, targetDbPath);

    // Verify restored database can be opened cleanly
    const restoredDb = new Database(targetDbPath);
    try {
        const integrity = restoredDb.pragma('integrity_check');
        const userCount = restoredDb.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const attendanceCount = restoredDb.prepare('SELECT COUNT(*) AS count FROM attendance').get().count;
        console.log(`[RESTORE] Restored database verification:`);
        console.log(`  - Integrity: ${integrity[0]?.integrity_check || 'ok'}`);
        console.log(`  - Registered users: ${userCount}`);
        console.log(`  - Attendance records: ${attendanceCount}`);
    } finally {
        restoredDb.close();
    }

    console.log(`[RESTORE] Database restored successfully to: ${targetDbPath}`);
    return targetDbPath;
}

if (require.main === module) {
    const backupArg = process.argv[2];
    performRestore(backupArg)
        .then((file) => {
            console.log(`[RESTORE] Completed successfully. Target: ${file}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('[RESTORE FATAL] Database restoration failed:', err.message);
            process.exit(1);
        });
}

module.exports = { performRestore, validateBackupFile };
