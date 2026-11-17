module.exports = {
    up: (db) => {
        console.log('[MIGRATION 018] Creating user_sessions table for multi-device session management and refresh token rotation...');

        // 1. Create user_sessions table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                device_name TEXT,
                device_type TEXT DEFAULT 'desktop',
                platform TEXT DEFAULT 'web',
                browser TEXT,
                refresh_token_hash TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                is_revoked INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `).run();

        // 2. Create indexes for performance and security lookups
        db.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(user_id, device_id, is_revoked)').run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token_hash)').run();
        db.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at, is_revoked)').run();

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        console.log('[MIGRATION 018] user_sessions table and indexes created successfully.');
    }
};

