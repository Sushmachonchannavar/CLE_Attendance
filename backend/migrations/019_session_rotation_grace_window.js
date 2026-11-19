module.exports = {
    up: (db) => {
        console.log('[MIGRATION 019] Adding grace window columns to user_sessions...');
        const tableInfo = db.prepare("PRAGMA table_info(user_sessions)").all();
        const columnNames = new Set(tableInfo.map(c => c.name));

        if (!columnNames.has('prev_refresh_token_hash')) {
            db.prepare('ALTER TABLE user_sessions ADD COLUMN prev_refresh_token_hash TEXT').run();
        }
        if (!columnNames.has('rotated_at')) {
            db.prepare('ALTER TABLE user_sessions ADD COLUMN rotated_at DATETIME').run();
        }

        db.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_prev_token ON user_sessions(prev_refresh_token_hash)').run();

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        console.log('[MIGRATION 019] Grace window columns and index added successfully.');
    }
};
