module.exports = {
    up: (db) => {
        // Ensure predefined demo accounts exist for Admin and Principal testing
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, role, department, employee_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertUser.run(1, 'Admin Testing User', '9999999999', 'admin', 'Administration', 'EMP000', 'active');
        insertUser.run(2, 'Principal Dr. User', '8888888888', 'hoi', 'Executive Academic Administration', 'EMP001', 'active');

        // Ensure roles and active status are set appropriately
        db.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE phone = '9999999999'").run();
        db.prepare("UPDATE users SET role = 'hoi', status = 'active' WHERE phone = '8888888888'").run();
    }
};

