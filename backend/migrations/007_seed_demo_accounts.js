module.exports = {
    up: (db) => {
        // Ensure predefined demo account exists for Principal testing only
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, role, department, employee_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertUser.run(2, 'Principal Dr. User', '8888888888', 'hoi', 'Executive Academic Administration', 'EMP001', 'active');

        // Ensure Principal role and active status are set appropriately
        db.prepare("UPDATE users SET role = 'hoi', status = 'active' WHERE phone = '8888888888'").run();
    }
};

