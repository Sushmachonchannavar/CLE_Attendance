module.exports = {
    up: (db) => {
        console.log('[MIGRATION 022] Permanently deleting test user 1084 (phone 9686009444) and all related records...');
        const userIds = [1084];
        const targetPhones = ['9686009444', '+919686009444'];
        const targetEmpIds = ['EMP-9686009444'];

        // 1. Delete dependent sessions
        try {
            db.prepare("DELETE FROM user_sessions WHERE user_id IN (1084) OR user_id IN (SELECT id FROM users WHERE phone LIKE '%9686009444%')").run();
        } catch (e) {}

        // 2. Delete attendance records
        try {
            db.prepare("DELETE FROM attendance WHERE user_id IN (1084) OR user_id IN (SELECT id FROM users WHERE phone LIKE '%9686009444%')").run();
        } catch (e) {}

        // 3. Delete leave requests
        try {
            db.prepare("DELETE FROM leaves WHERE user_id IN (1084) OR user_id IN (SELECT id FROM users WHERE phone LIKE '%9686009444%')").run();
        } catch (e) {}

        // 4. Delete on-duty requests
        try {
            db.prepare("DELETE FROM od_requests WHERE user_id IN (1084) OR user_id IN (SELECT id FROM users WHERE phone LIKE '%9686009444%')").run();
        } catch (e) {}

        // 5. Delete live tracking / location records
        try {
            db.prepare("DELETE FROM employee_locations WHERE user_id IN (1084) OR user_id IN (SELECT id FROM users WHERE phone LIKE '%9686009444%')").run();
        } catch (e) {}

        // 6. Delete approval audit logs referencing this user
        try {
            db.prepare("DELETE FROM approval_audit_logs WHERE reviewer_id IN (1084)").run();
        } catch (e) {}

        // 7. Delete OTP records
        try {
            for (const phone of targetPhones) {
                db.prepare("DELETE FROM otps WHERE phone = ? OR phone LIKE ?").run(phone, `%${phone}%`);
            }
        } catch (e) {}

        // 8. Delete attendance OTP records
        try {
            for (const empId of targetEmpIds) {
                db.prepare("DELETE FROM attendance_otps WHERE employee_id = ?").run(empId);
            }
        } catch (e) {}

        // 9. Delete auth lockouts
        try {
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE '%9686009444%'").run();
        } catch (e) {}

        // 10. Permanently delete the user account from users table
        const result = db.prepare("DELETE FROM users WHERE id = 1084 OR phone LIKE '%9686009444%' OR employee_id = 'EMP-9686009444'").run();
        console.log(`[MIGRATION 022] Permanently deleted ${result.changes} user record(s) for 9686009444.`);

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}
    }
};
