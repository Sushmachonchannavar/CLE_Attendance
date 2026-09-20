const fs = require('fs');
const path = require('path');

function getMigrationsDir() {
    return path.resolve(__dirname);
}

function runMigrations(db) {
    console.log('[MIGRATIONS] Checking database schema version...');

    // Create schema_migrations tracking table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    const migrationsDir = getMigrationsDir();
    const files = fs.readdirSync(migrationsDir)
        .filter(f => /^\d{3}_.+\.js$/.test(f))
        .sort();

    const appliedRows = db.prepare('SELECT version FROM schema_migrations').all();
    const appliedSet = new Set(appliedRows.map(r => r.version));

    let count = 0;
    for (const file of files) {
        const version = file.split('_')[0];
        if (!appliedSet.has(version)) {
            console.log(`[MIGRATIONS] Applying migration: ${file}...`);
            const migration = require(path.join(migrationsDir, file));
            
            // Run migration in a transaction if supported
            const applyMigration = db.transaction(() => {
                migration.up(db);
                db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, file);
            });

            try {
                applyMigration();
                count++;
                console.log(`[MIGRATIONS] Successfully applied: ${file}`);
            } catch (err) {
                console.error(`[MIGRATIONS FATAL] Failed applying ${file}:`, err.message);
                throw err;
            }
        }
    }

    if (count === 0) {
        console.log('[MIGRATIONS] Database schema is up to date.');
    } else {
        console.log(`[MIGRATIONS] Applied ${count} pending migration(s).`);
    }
}

module.exports = { runMigrations };

if (require.main === module) {
    const db = require('../database');
    runMigrations(db);
    console.log('[MIGRATIONS] Migration process finished.');
}
