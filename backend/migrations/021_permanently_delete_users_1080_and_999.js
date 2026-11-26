module.exports = {
    up: (db) => {
        console.log('[MIGRATION 021] Permanently deleting users with id 1080 and id 999...');
        const userIds = [1080, 999];
        const targetPhones = ['9876543210', '+919876543210', '1234567890', '+911234567890'];
        const targetEmpIds = ['EMP-9876543210', 'EMP-1234567890'];

        // 1. Delete dependent sessions
        try {
            db.prepare("DELETE FROM user_sessions WHERE user_id IN (1080, 999)").run();
        } catch (e) {}

        // 2. Delete attendance records
        try {
            db.prepare("DELETE FROM attendance WHERE user_id IN (1080, 999)").run();
        } catch (e) {}

        // 3. Delete leave requests
        try {
            db.prepare("DELETE FROM leaves WHERE user_id IN (1080, 999)").run();
        } catch (e) {}

        // 4. Delete on-duty requests
        try {
            db.prepare("DELETE FROM od_requests WHERE user_id IN (1080, 999)").run();
        } catch (e) {}

        // 5. Delete live tracking / location records
        try {
            db.prepare("DELETE FROM employee_locations WHERE user_id IN (1080, 999)").run();
        } catch (e) {}

        // 6. Delete approval audit logs referencing these users
        try {
            db.prepare("DELETE FROM approval_audit_logs WHERE reviewer_id IN (1080, 999)").run();
        } catch (e) {}

        // 7. Delete OTP records
        try {
            for (const phone of targetPhones) {
                db.prepare("DELETE FROM otps WHERE phone = ?").run(phone);
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
            for (const phone of ['9876543210', '1234567890']) {
                db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE ?").run(`%${phone}%`);
            }
        } catch (e) {}

        // 10. Permanently delete the user accounts from users table
        const result = db.prepare("DELETE FROM users WHERE id IN (1080, 999) OR phone IN ('9876543210', '+919876543210', '1234567890', '+911234567890')").run();
        console.log(`[MIGRATION 021] Permanently deleted ${result.changes} user record(s) from users table.`);

        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}
    }
};
