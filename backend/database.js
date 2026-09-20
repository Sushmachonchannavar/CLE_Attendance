const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { runMigrations } = require('./migrations/runner');

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

console.log(`[DATABASE] Opening SQLite database: ${dbPath} (exists: ${fs.existsSync(dbPath)}) (mode: ${process.env.NODE_ENV || 'development'})`);

const db = new Database(dbPath);

// Enable foreign key constraints and write-ahead logging
db.pragma('foreign_keys = ON');
try {
    db.pragma('journal_mode = WAL');
} catch (e) {
    // WAL might be restricted in some test memory modes
}

// Run deterministic versioned migrations
runMigrations(db);

module.exports = db;
