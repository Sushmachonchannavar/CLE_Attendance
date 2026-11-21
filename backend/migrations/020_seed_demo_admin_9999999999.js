module.exports = {
    up: (db) => {
        console.log('[MIGRATION 020] Provisioning Demo Admin (9999999999)...');
        const demoPhone = '9999999999';
        const realAdminPhone = '9448378417';

        // 1. Ensure the real Admin (9448378417) is active with role 'admin'
        const realAdmin = db.prepare("SELECT id FROM users WHERE phone LIKE ?").get(`%${realAdminPhone}%`);
        if (realAdmin) {
            db.prepare("UPDATE users SET role = 'admin', status = 'active', department = 'Administration' WHERE id = ?").run(realAdmin.id);
        } else {
            db.prepare(`
                INSERT INTO users (name, phone, role, department, employee_id, status)
                VALUES ('System Administrator', ?, 'admin', 'Administration', ?, 'active')
            `).run(realAdminPhone, `EMP-${realAdminPhone}`);
        }

        // 2. Ensure Demo Admin (9999999999) exists with role 'admin' and status 'active'
        const existingDemo = db.prepare("SELECT id FROM users WHERE phone = ? OR phone = ?").get(demoPhone, '+91' + demoPhone);
        if (existingDemo) {
            db.prepare(`
                UPDATE users 
                SET role = 'admin', 
                    status = 'active', 
                    name = 'System Administrator (Demo)',
                    department = 'Administration',
                    college = 'CLE Society Campus',
                    designation = 'Administrator'
                WHERE id = ?
            `).run(existingDemo.id);
        } else {
            db.prepare(`
                INSERT INTO users (name, phone, role, department, college, designation, employee_id, status)
                VALUES ('System Administrator (Demo)', ?, 'admin', 'Administration', 'CLE Society Campus', 'Administrator', 'EMP-9999999999', 'active')
            `).run(demoPhone);
        }

        // 3. Clear any lingering auth lockouts or stale OTPs for demo admin
        try {
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ? OR identifier LIKE ?").run(`%${demoPhone}%`, '%EMP-9999999999%');
            db.prepare("DELETE FROM otps WHERE phone LIKE ?").run(`%${demoPhone}%`);
            db.prepare("DELETE FROM attendance_otps WHERE employee_id LIKE '%9999999999%'").run();
        } catch (e) {
            // Non-fatal
        }

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        console.log('[MIGRATION 020] Demo Admin (9999999999) provisioned successfully with role: admin.');
    }
};
