module.exports = {
    up: (db) => {
        const targetPhone = '9448378417';
        const previousPhone = '9187477277';

        // 1. Remove previous admin account 9187477277
        try {
            db.prepare("DELETE FROM users WHERE phone LIKE ? OR employee_id LIKE ?").run(`%${previousPhone}%`, `%${previousPhone}%`);
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${previousPhone}%`);
            db.prepare("DELETE FROM otps WHERE phone LIKE ?").run(`%${previousPhone}%`);
        } catch (e) {}

        // 2. Demote any other admin accounts to staff so only 9448378417 has the admin role
        db.prepare("UPDATE users SET role = 'staff' WHERE role = 'admin' AND phone NOT LIKE ?").run(`%${targetPhone}%`);

        // 3. Insert or update 9448378417 as Administrator
        const existing = db.prepare("SELECT id FROM users WHERE phone LIKE ? OR employee_id LIKE ?").get(`%${targetPhone}%`, `%${targetPhone}%`);
        if (existing) {
            db.prepare("UPDATE users SET role = 'admin', status = 'active', department = 'Administration' WHERE id = ?").run(existing.id);
        } else {
            db.prepare(`
                INSERT INTO users (name, phone, role, department, employee_id, status)
                VALUES ('System Administrator', ?, 'admin', 'Administration', ?, 'active')
            `).run(targetPhone, `EMP-${targetPhone}`);
        }

        // 4. Clear any lingering auth lockouts for target phone
        try {
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${targetPhone}%`);
        } catch (e) {}

        // 5. Clear any stale OTPs for target phone
        try {
            db.prepare("DELETE FROM otps WHERE phone LIKE ?").run(`%${targetPhone}%`);
        } catch (e) {}
    }
};
