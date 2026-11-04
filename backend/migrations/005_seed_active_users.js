module.exports = {
    up: (db) => {
        const users = [
            [102, 'Sushma Chonchannavar', '6360670247', 'admin', 'Administration', 'EMP-6360670247', 'active']
        ];
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, role, department, employee_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const u of users) {
            insertUser.run(...u);
        }
    }
};
