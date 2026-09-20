module.exports = {
    up: (db) => {
        // Add audit columns to leaves table
        try { db.prepare('ALTER TABLE leaves ADD COLUMN reviewed_by INTEGER').run(); } catch (e) {}
        try { db.prepare('ALTER TABLE leaves ADD COLUMN decision_time TEXT').run(); } catch (e) {}
        try { db.prepare('ALTER TABLE leaves ADD COLUMN decision_reason TEXT').run(); } catch (e) {}

        // Add audit columns to od_requests table
        try { db.prepare('ALTER TABLE od_requests ADD COLUMN reviewed_by INTEGER').run(); } catch (e) {}
        try { db.prepare('ALTER TABLE od_requests ADD COLUMN decision_time TEXT').run(); } catch (e) {}
        try { db.prepare('ALTER TABLE od_requests ADD COLUMN decision_reason TEXT').run(); } catch (e) {}

        // Create approval_audit_logs table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS approval_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_type TEXT NOT NULL, -- 'leave' or 'od'
                request_id INTEGER NOT NULL,
                reviewer_id INTEGER NOT NULL,
                reviewer_role TEXT NOT NULL,
                previous_status TEXT,
                new_status TEXT NOT NULL,
                decision_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (reviewer_id) REFERENCES users (id)
            )
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_request 
            ON approval_audit_logs(request_type, request_id)
        `).run();
    }
};
