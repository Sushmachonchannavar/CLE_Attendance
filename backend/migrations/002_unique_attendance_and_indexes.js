module.exports = {
    up: (db) => {
        // Deduplicate attendance records before creating unique index
        db.prepare(`
            DELETE FROM attendance
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM attendance
                GROUP BY user_id, date
            )
        `).run();

        // 1. Unique index on attendance (user_id, date)
        db.prepare(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date 
            ON attendance(user_id, date)
        `).run();

        // 2. Date index on attendance
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_attendance_date 
            ON attendance(date)
        `).run();

        // 3. Indexes on users
        db.prepare(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id 
            ON users(employee_id)
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_users_phone 
            ON users(phone)
        `).run();

        // 4. Indexes on leaves
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_leaves_user_status 
            ON leaves(user_id, status)
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_leaves_dates 
            ON leaves(start_date, end_date)
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_leaves_role_status 
            ON leaves(role, status)
        `).run();

        // 5. Indexes on OD requests
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_od_user_status 
            ON od_requests(user_id, status)
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_od_date 
            ON od_requests(date)
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_od_role_status 
            ON od_requests(role, status)
        `).run();

        // 6. Indexes on tracking
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_employee_locations_user_id 
            ON employee_locations(user_id)
        `).run();

        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_employee_locations_timestamp 
            ON employee_locations(timestamp)
        `).run();
    }
};
