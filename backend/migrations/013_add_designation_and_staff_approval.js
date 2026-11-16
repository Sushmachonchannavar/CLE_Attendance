module.exports = {
    up: (db) => {
        // 1. Add designation column to users table if not exists
        try {
            const tableInfo = db.prepare("PRAGMA table_info(users)").all();
            const hasDesignation = tableInfo.some(col => col.name === 'designation');
            if (!hasDesignation) {
                db.prepare("ALTER TABLE users ADD COLUMN designation TEXT DEFAULT 'Faculty Member'").run();
                console.log("[MIGRATIONS 013] Added designation column to users table.");
            }
        } catch (e) {
            console.warn("[MIGRATIONS 013] Designation column check/alter warning:", e.message);
        }

        // 2. Set default designation for any existing staff users where designation is null
        try {
            db.prepare("UPDATE users SET designation = 'Faculty Member' WHERE designation IS NULL OR designation = ''").run();
        } catch (e) {}

        // 3. Ensure index on status and role for fast staff registration queries
        try {
            db.prepare("CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status)").run();
        } catch (e) {}
    }
};
