module.exports = {
    up: (db) => {
        // Add attempt counter to attendance_otps
        try { db.prepare('ALTER TABLE attendance_otps ADD COLUMN attempts INTEGER DEFAULT 0').run(); } catch (e) {}

        // Add attempt counter to otps
        try { db.prepare('ALTER TABLE otps ADD COLUMN attempts INTEGER DEFAULT 0').run(); } catch (e) {}

        // Add UTC timestamp columns to attendance
        try { db.prepare('ALTER TABLE attendance ADD COLUMN punch_in_utc TEXT').run(); } catch (e) {}
        try { db.prepare('ALTER TABLE attendance ADD COLUMN punch_out_utc TEXT').run(); } catch (e) {}

        // Create auth_lockouts table for brute-force protection
        db.prepare(`
            CREATE TABLE IF NOT EXISTS auth_lockouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identifier TEXT NOT NULL,
                locked_until DATETIME NOT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_auth_lockouts_identifier 
            ON auth_lockouts(identifier, locked_until)
        `).run();
    }
};
