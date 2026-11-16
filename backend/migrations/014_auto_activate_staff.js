module.exports = {
    up: (db) => {
        // Automatically activate any existing pending or rejected staff accounts
        try {
            db.prepare("UPDATE users SET status = 'active' WHERE status IN ('pending', 'rejected')").run();
            console.log("[MIGRATIONS 014] Automatically activated all pending and rejected staff accounts.");
        } catch (e) {
            console.warn("[MIGRATIONS 014] Error activating staff accounts:", e.message);
        }
    }
};
