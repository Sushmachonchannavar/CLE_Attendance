module.exports = {
    up: (db) => {
        // Eight standard registered staff members guaranteed to persist permanently
        const permanentStaff = [
            {
                name: 'Demo Staff 1',
                phone: '1234567890',
                role: 'staff',
                college: 'CLE Society Degree College',
                department: 'Engineering',
                designation: 'Faculty Member',
                employee_id: 'EMP100',
                status: 'active'
            },
            {
                name: 'Prof. Ramesh Kulkarni',
                phone: '9876543210',
                role: 'staff',
                college: 'CLE Society Degree College',
                department: 'Computer Science & Engineering',
                designation: 'Professor',
                employee_id: 'EMP-9876543210',
                status: 'active'
            },
            {
                name: 'Test Staff',
                phone: '9876543211',
                role: 'staff',
                college: 'CLE Society Degree College',
                department: 'Computer Science',
                designation: 'Faculty Member',
                employee_id: 'EMP-9876543211',
                status: 'active'
            },
            {
                name: 'Test Employee 1',
                phone: '917410800888',
                role: 'staff',
                college: 'CLE Society Degree College',
                department: 'Engineering',
                designation: 'Faculty Member',
                employee_id: 'EMP_TEST_1',
                status: 'active'
            },
            {
                name: 'Test Employee 2',
                phone: '919876543210',
                role: 'staff',
                college: 'CLE Society Degree College',
                department: 'Engineering',
                designation: 'Faculty Member',
                employee_id: 'EMP_TEST_2',
                status: 'active'
            },
            {
                name: 'Sushma Chonchannavar',
                phone: '6360670247',
                role: 'staff',
                college: 'CLE Society Degree Chikodi',
                department: 'Bsc',
                designation: 'Faculty Member',
                employee_id: 'EMP-6360670247',
                status: 'active'
            },
            {
                name: 'Sumit Chonchannavar',
                phone: '8296264109',
                role: 'staff',
                college: 'CLE Society Degree Chikodi',
                department: 'Computer Science',
                designation: 'Assistant Professor',
                employee_id: 'EMP-8296264109',
                status: 'active'
            },
            {
                name: 'Ramesh Patil',
                phone: '9876543219',
                role: 'staff',
                college: 'CLE Society Degree College',
                department: 'Electronics',
                designation: 'Lecturer',
                employee_id: 'EMP-9876543219',
                status: 'active'
            }
        ];

        const insertStmt = db.prepare(`
            INSERT INTO users (name, phone, role, college, department, designation, employee_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const staff of permanentStaff) {
            try {
                // Check if user exists by phone or employee_id
                const existing = db.prepare(`
                    SELECT id, status, role FROM users 
                    WHERE phone = ? OR phone LIKE ? OR employee_id = ?
                `).get(staff.phone, `%${staff.phone.slice(-10)}%`, staff.employee_id);

                if (existing) {
                    db.prepare(`
                        UPDATE users 
                        SET status = 'active', role = 'staff', designation = COALESCE(designation, ?)
                        WHERE id = ?
                    `).run(staff.designation, existing.id);
                } else {
                    insertStmt.run(
                        staff.name,
                        staff.phone,
                        staff.role,
                        staff.college,
                        staff.department,
                        staff.designation,
                        staff.employee_id,
                        staff.status
                    );
                }
            } catch (err) {
                console.warn(`[MIGRATION 016] Notice syncing staff user ${staff.name}:`, err.message);
            }
        }

        // Activate all other staff accounts in users table
        try {
            db.prepare(`
                UPDATE users 
                SET status = 'active' 
                WHERE role = 'staff' AND (status != 'active' OR status IS NULL)
            `).run();
        } catch (e) {}

        const finalCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'staff' AND status = 'active'").get().count;
        console.log(`[MIGRATIONS 016] Successfully ensured ${finalCount} active registered staff members.`);
    }
};
