module.exports = {
    up: (db) => {
        // Find user IDs matching 6360670247, 6360670274 or ID 102
        const targetUsers = db.prepare(`
            SELECT id FROM users 
            WHERE phone LIKE '%6360670247%' 
               OR phone LIKE '%6360670274%' 
               OR employee_id LIKE '%6360670247%' 
               OR employee_id LIKE '%6360670274%' 
               OR id = 102
        `).all();

        const userIds = targetUsers.map(u => u.id);

        if (userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');

            // 1. Reassign approval_audit_logs if reviewer was one of these users
            try {
                // Find fallback reviewer (e.g. Principal user id 2 or any other active HOI/Admin)
                const fallback = db.prepare(`
                    SELECT id FROM users 
                    WHERE role IN ('hoi', 'principal', 'admin') 
                      AND id NOT IN (${placeholders}) 
                    ORDER BY id ASC LIMIT 1
                `).get(...userIds);

                if (fallback) {
                    db.prepare(`UPDATE approval_audit_logs SET reviewer_id = ? WHERE reviewer_id IN (${placeholders})`).run(fallback.id, ...userIds);
                } else {
                    db.prepare(`DELETE FROM approval_audit_logs WHERE reviewer_id IN (${placeholders})`).run(...userIds);
                }
            } catch (e) {
                // Non-fatal if table doesn't exist
            }

            // 2. Delete child records referencing these user IDs
            try {
                db.prepare(`DELETE FROM attendance WHERE user_id IN (${placeholders})`).run(...userIds);
            } catch (e) {}

            try {
                db.prepare(`DELETE FROM leaves WHERE user_id IN (${placeholders})`).run(...userIds);
            } catch (e) {}

            try {
                db.prepare(`DELETE FROM od_requests WHERE user_id IN (${placeholders})`).run(...userIds);
            } catch (e) {}

            try {
                db.prepare(`DELETE FROM employee_locations WHERE user_id IN (${placeholders})`).run(...userIds);
            } catch (e) {}

            // 3. Delete from users
            db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds);
        }

        // 4. Delete any remaining OTPs, attendance OTPs, and auth lockouts for these numbers
        try {
            db.prepare(`
                DELETE FROM otps 
                WHERE phone LIKE '%6360670247%' 
                   OR phone LIKE '%6360670274%'
            `).run();
        } catch (e) {}

        try {
            db.prepare(`
                DELETE FROM attendance_otps 
                WHERE employee_id LIKE '%6360670247%' 
                   OR employee_id LIKE '%6360670274%'
            `).run();
        } catch (e) {}

        try {
            db.prepare(`
                DELETE FROM auth_lockouts 
                WHERE identifier LIKE '%6360670247%' 
                   OR identifier LIKE '%6360670274%' 
                   OR identifier LIKE '%EMP-6360670247%' 
                   OR identifier LIKE '%EMP-6360670274%'
            `).run();
        } catch (e) {}
    }
};
