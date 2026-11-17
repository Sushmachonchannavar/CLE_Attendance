const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { runMigrations } = require('./migrations/runner');
const { restoreLatestBackupIfExists, checkpointDatabase, createDatabaseBackup } = require('./utils/backup');

function getDatabasePath() {
    // Check for explicit environment variables (DATABASE_PATH or legacy DB_FILE)
    const configuredPath = process.env.DATABASE_PATH || process.env.DB_FILE;
    if (configuredPath && typeof configuredPath === 'string' && configuredPath.trim() !== '') {
        const trimmed = configuredPath.trim();
        return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(__dirname, trimmed);
    }
    if (process.env.NODE_ENV === 'test') {
        return path.resolve(__dirname, 'database.test.sqlite');
    }
    if (process.env.NODE_ENV === 'staging') {
        return path.resolve(__dirname, 'database.staging.sqlite');
    }
    // Default local development database
    return path.resolve(__dirname, 'database.sqlite');
}

const dbPath = getDatabasePath();

// Ensure the directory exists before better-sqlite3 attempts to open or create the file
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    console.log(`[DATABASE] Creating directory for database storage: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
}

// Disaster recovery: If database file is missing/empty, restore from latest persistent snapshot
if (process.env.NODE_ENV !== 'test') {
    restoreLatestBackupIfExists(dbPath);
}

console.log(`[DATABASE] Opening SQLite database: ${dbPath} (exists: ${fs.existsSync(dbPath)}) (mode: ${process.env.NODE_ENV || 'development'})`);

const db = new Database(dbPath);

// Enable foreign key constraints, timeout, and write-ahead logging
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 10000');
try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 50');
} catch (e) {
    // WAL might be restricted in some test memory modes
}

// Attach production checkpoint and backup helpers
db.checkpoint = () => checkpointDatabase(db);
db.createBackup = (label) => createDatabaseBackup(db, label);

// Run deterministic versioned migrations
runMigrations(db);

// Flush WAL checkpoint on process exit for complete persistence across restarts
const flushWal = () => {
    try {
        checkpointDatabase(db);
    } catch (e) {}
};

process.on('exit', flushWal);
process.on('SIGINT', () => { flushWal(); process.exit(0); });
process.on('SIGTERM', () => { flushWal(); process.exit(0); });

// Create startup backup snapshot for disaster recovery
if (process.env.NODE_ENV !== 'test') {
    createDatabaseBackup(db, 'startup').catch(err => {
        console.warn('[DATABASE] Startup backup warning:', err.message);
    });
}

module.exports = db;
