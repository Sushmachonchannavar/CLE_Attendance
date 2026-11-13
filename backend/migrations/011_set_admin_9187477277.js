module.exports = {
    up: (db) => {
        const targetPhone = '9187477277';

        // 1. Demote any other admin accounts to staff so only 9187477277 has the admin role
        db.prepare("UPDATE users SET role = 'staff' WHERE role = 'admin' AND phone NOT LIKE ?").run(`%${targetPhone}%`);

        // 2. Insert or update 9187477277 as Administrator
        const existing = db.prepare("SELECT id FROM users WHERE phone LIKE ? OR employee_id LIKE ?").get(`%${targetPhone}%`, `%${targetPhone}%`);
        if (existing) {
            db.prepare("UPDATE users SET role = 'admin', status = 'active', department = 'Administration' WHERE id = ?").run(existing.id);
        } else {
            db.prepare(`
                INSERT INTO users (name, phone, role, department, employee_id, status)
                VALUES ('System Administrator', ?, 'admin', 'Administration', ?, 'active')
            `).run(targetPhone, `EMP-${targetPhone}`);
        }

        // 3. Clear any lingering auth lockouts for target phone
        try {
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${targetPhone}%`);
        } catch (e) {}

        // 4. Clear any stale OTPs for target phone
        try {
            db.prepare("DELETE FROM otps WHERE phone LIKE ?").run(`%${targetPhone}%`);
        } catch (e) {}
    }
};

