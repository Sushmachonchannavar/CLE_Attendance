module.exports = {
    up: (db) => {
        const users = [
            [102, 'Sushma Chonchannavar', '6360670247', 'staff', 'Bsc', 'EMP-6360670247', 'active'],
            [103, 'Prof. Ramesh Kulkarni', '9876543210', 'staff', 'Engineering', 'EMP101', 'active']
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
