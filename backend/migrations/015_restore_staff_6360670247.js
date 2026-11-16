module.exports = {
    up: (db) => {
        try {
            const existing = db.prepare("SELECT id FROM users WHERE phone LIKE '%6360670247%'").get();
            if (!existing) {
                db.prepare(`
                    INSERT INTO users (name, phone, role, college, department, designation, employee_id, status)
                    VALUES ('Sushma Chonchannavar', '6360670247', 'staff', 'CLE Society Degree Chikodi', 'Bsc', 'Faculty Member', 'EMP-6360670247', 'active')
                `).run();
                console.log("[MIGRATIONS 015] Restored staff user Sushma Chonchannavar (6360670247)");
            } else {
                db.prepare("UPDATE users SET status = 'active', role = 'staff' WHERE id = ?").run(existing.id);
                console.log("[MIGRATIONS 015] Verified active status for staff user Sushma Chonchannavar (6360670247)");
            }
        } catch (e) {
            console.warn("[MIGRATIONS 015] Error ensuring staff user 6360670247:", e.message);
        }
    }
};
