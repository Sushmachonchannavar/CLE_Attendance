module.exports = {
    up: (db) => {
        console.log('[MIGRATION 023] Ensuring registered staff member 6360670247 exists persistently in SQLite...');
        const staffPhone = '6360670247';
        const staffEmpId = 'EMP-6360670247';
        const staffName = 'Sushma Chonchannavar';
        const staffDept = 'B.Sc.';
        const staffCollege = "CLE Society's Degree College,Chikodi";
        const staffDesig = 'Lecture';

        // Check if user already exists by phone (any variation) or employee_id
        const existing = db.prepare(`
            SELECT id, name, phone, employee_id, role, status 
            FROM users 
            WHERE phone = ? OR phone = ? OR phone = ? OR phone LIKE ? OR employee_id = ?
        `).get(staffPhone, '+91' + staffPhone, '91' + staffPhone, `%${staffPhone}%`, staffEmpId);

        if (existing) {
            console.log(`[MIGRATION 023] Staff user already exists (id: ${existing.id}, phone: ${existing.phone}). Ensuring active staff status.`);
            db.prepare(`
                UPDATE users 
                SET role = 'staff', 
                    status = 'active',
                    name = COALESCE(NULLIF(name, ''), ?),
                    department = COALESCE(NULLIF(department, ''), ?),
                    college = COALESCE(NULLIF(college, ''), ?),
                    designation = COALESCE(NULLIF(designation, ''), ?),
                    employee_id = COALESCE(NULLIF(employee_id, ''), ?)
                WHERE id = ?
            `).run(staffName, staffDept, staffCollege, staffDesig, staffEmpId, existing.id);
        } else {
            console.log('[MIGRATION 023] Inserting persistent staff record for 6360670247.');
            const idTaken = db.prepare("SELECT id FROM users WHERE id = 1076").get();
            if (!idTaken) {
                db.prepare(`
                    INSERT INTO users (id, name, phone, role, department, college, designation, employee_id, status)
                    VALUES (1076, ?, ?, 'staff', ?, ?, ?, ?, 'active')
                `).run(staffName, staffPhone, staffDept, staffCollege, staffDesig, staffEmpId);
            } else {
                db.prepare(`
                    INSERT INTO users (name, phone, role, department, college, designation, employee_id, status)
                    VALUES (?, ?, 'staff', ?, ?, ?, ?, 'active')
                `).run(staffName, staffPhone, staffDept, staffCollege, staffDesig, staffEmpId);
            }
        }

        // Clean up any lingering auth lockouts for this number
        try {
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ? OR identifier LIKE ?").run(`%${staffPhone}%`, `%${staffEmpId}%`);
        } catch (e) {}

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        console.log('[MIGRATION 023] Staff 6360670247 verification complete.');
    }
};
