module.exports = {
    up: (db) => {
        // Reassign any audit log reviewer references from demo admin (user_id = 1) to Principal (user_id = 2)
        try {
            db.prepare("UPDATE approval_audit_logs SET reviewer_id = 2 WHERE reviewer_id = 1").run();
        } catch (e) {
            // Non-fatal
        }

        // Completely remove demo admin user (9999999999) and all associated demo tokens/records
        try {
            db.prepare("DELETE FROM users WHERE phone = '9999999999' OR employee_id = 'EMP000'").run();
            db.prepare("DELETE FROM otps WHERE phone LIKE '%9999999999%'").run();
            db.prepare("DELETE FROM attendance_otps WHERE employee_id = 'EMP000'").run();
            db.prepare("DELETE FROM auth_lockouts WHERE identifier LIKE '%9999999999%' OR identifier = 'EMP000'").run();
        } catch (e) {
            // Non-fatal
        }
    }
};
