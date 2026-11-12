module.exports = {
    up: (db) => {
        const users = [];
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (id, name, phone, role, department, employee_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const u of users) {
            insertUser.run(...u);
        }
    }
};
