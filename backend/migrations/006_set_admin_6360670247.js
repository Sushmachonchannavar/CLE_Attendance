module.exports = {
    up: (db) => {
        // Set user 6360670247 as Administrator
        const existing = db.prepare("SELECT id FROM users WHERE phone = '6360670247'").get();
        if (existing) {
            db.prepare("UPDATE users SET role = 'admin', department = 'Administration' WHERE phone = '6360670247'").run();
        } else {
            db.prepare(`
                INSERT INTO users (id, name, phone, role, department, employee_id, status)
                VALUES (102, 'Sushma Chonchannavar', '6360670247', 'admin', 'Administration', 'EMP-6360670247', 'active')
            `).run();
        }
    }
};

