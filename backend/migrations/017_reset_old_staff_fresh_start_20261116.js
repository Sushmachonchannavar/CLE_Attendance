module.exports = {
    up: (db) => {
        console.log('[MIGRATION 017] Executing database reset for fresh staff start from 16 November 2026...');

        // 1. Identify all staff users to remove (strictly preserving Admin and Principal)
        const staffUsers = db.prepare(`
            SELECT id, phone, employee_id 
            FROM users 
            WHERE phone NOT IN ('9448378417', '8888888888')
              AND LOWER(role) NOT IN ('admin', 'hoi', 'principal')
        `).all();

        const staffIds = staffUsers.map(u => u.id);
        const staffPhones = staffUsers.map(u => u.phone).filter(Boolean);
        const staffEmpIds = staffUsers.map(u => u.employee_id).filter(Boolean);

        console.log(`[MIGRATION 017] Found ${staffIds.length} historical staff account(s) to remove.`);

        if (staffIds.length > 0) {
            const idPlaceholders = staffIds.map(() => '?').join(',');

            // 2. Find historical leave & OD IDs associated with these staff
            const leaveIds = db.prepare(`SELECT id FROM leaves WHERE user_id IN (${idPlaceholders})`)
                .all(...staffIds).map(r => r.id);
            const odIds = db.prepare(`SELECT id FROM od_requests WHERE user_id IN (${idPlaceholders})`)
                .all(...staffIds).map(r => r.id);

            // 3. Remove approval audit logs associated with staff requests or staff reviewers
            if (leaveIds.length > 0) {
                const leavePlaceholders = leaveIds.map(() => '?').join(',');
                db.prepare(`DELETE FROM approval_audit_logs WHERE request_type = 'leave' AND request_id IN (${leavePlaceholders})`).run(...leaveIds);
            }
            if (odIds.length > 0) {
                const odPlaceholders = odIds.map(() => '?').join(',');
                db.prepare(`DELETE FROM approval_audit_logs WHERE request_type = 'od' AND request_id IN (${odPlaceholders})`).run(...odIds);
            }
            db.prepare(`DELETE FROM approval_audit_logs WHERE reviewer_id IN (${idPlaceholders})`).run(...staffIds);

            // 4. Remove attendance records for staff
            db.prepare(`DELETE FROM attendance WHERE user_id IN (${idPlaceholders})`).run(...staffIds);

            // 5. Remove leaves and OD requests for staff
            db.prepare(`DELETE FROM leaves WHERE user_id IN (${idPlaceholders})`).run(...staffIds);
            db.prepare(`DELETE FROM od_requests WHERE user_id IN (${idPlaceholders})`).run(...staffIds);

            // 6. Remove employee location records for staff
            db.prepare(`DELETE FROM employee_locations WHERE user_id IN (${idPlaceholders})`).run(...staffIds);

            // 7. Remove OTPs and attendance OTPs associated with staff
            for (const phone of staffPhones) {
                const cleanPhone = phone.replace(/\D/g, '').slice(-10);
                db.prepare(`DELETE FROM otps WHERE phone = ? OR phone = ? OR phone LIKE ?`).run(phone, `+91${cleanPhone}`, `%${cleanPhone}%`);
            }

            for (const empId of staffEmpIds) {
                db.prepare(`DELETE FROM attendance_otps WHERE employee_id = ?`).run(empId);
                db.prepare(`DELETE FROM auth_lockouts WHERE identifier = ? OR identifier LIKE ?`).run(empId, `%${empId}%`);
            }

            for (const phone of staffPhones) {
                const cleanPhone = phone.replace(/\D/g, '').slice(-10);
                db.prepare(`DELETE FROM auth_lockouts WHERE identifier = ? OR identifier = ? OR identifier LIKE ?`).run(phone, `+91${cleanPhone}`, `%${cleanPhone}%`);
            }

            // 8. Delete staff records from users table
            db.prepare(`DELETE FROM users WHERE id IN (${idPlaceholders})`).run(...staffIds);
        }

        // 9. Clean up any lingering orphan records not linked to remaining admin/principal
        db.prepare(`
            DELETE FROM attendance 
            WHERE user_id NOT IN (SELECT id FROM users WHERE phone IN ('9448378417', '8888888888'))
        `).run();

        db.prepare(`
            DELETE FROM leaves 
            WHERE user_id NOT IN (SELECT id FROM users WHERE phone IN ('9448378417', '8888888888'))
        `).run();

        db.prepare(`
            DELETE FROM od_requests 
            WHERE user_id NOT IN (SELECT id FROM users WHERE phone IN ('9448378417', '8888888888'))
        `).run();

        db.prepare(`
            DELETE FROM employee_locations 
            WHERE user_id NOT IN (SELECT id FROM users WHERE phone IN ('9448378417', '8888888888'))
        `).run();

        // 10. Ensure Admin (9448378417) is active and verified
        const admin = db.prepare("SELECT id FROM users WHERE phone LIKE '%9448378417%'").get();
        if (admin) {
            db.prepare("UPDATE users SET role = 'admin', status = 'active', department = 'Administration' WHERE id = ?").run(admin.id);
        } else {
            db.prepare(`
                INSERT INTO users (name, phone, role, department, employee_id, status)
                VALUES ('System Administrator', '9448378417', 'admin', 'Administration', 'EMP-9448378417', 'active')
            `).run();
        }

        // 11. Ensure Principal (8888888888) is active and verified
        const principal = db.prepare("SELECT id FROM users WHERE phone LIKE '%8888888888%'").get();
        if (principal) {
            db.prepare("UPDATE users SET role = 'hoi', status = 'active', department = 'Executive Academic Administration' WHERE id = ?").run(principal.id);
        } else {
            db.prepare(`
                INSERT INTO users (name, phone, role, department, employee_id, status)
                VALUES ('Principal Dr. User', '8888888888', 'hoi', 'Executive Academic Administration', 'EMP001', 'active')
            `).run();
        }

        // 12. Checkpoint SQLite WAL to persist changes directly to disk
        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}

        const remainingStaff = db.prepare("SELECT COUNT(*) AS count FROM users WHERE LOWER(role) = 'staff'").get().count;
        console.log(`[MIGRATION 017] Reset complete. Remaining staff count: ${remainingStaff}.`);
    }
};
