const crypto = require('crypto');

/**
 * Checks whether demo login is enabled.
 * - In production (NODE_ENV === 'production'): STRICTLY DISABLED by default,
 *   unless explicitly set to 'true' via DEMO_LOGIN_ENABLED environment variable.
 * - In non-production (development, test): ENABLED by default,
 *   unless explicitly disabled via DEMO_LOGIN_ENABLED=false.
 */
function isDemoLoginEnabled() {
    if (process.env.NODE_ENV === 'production') {
        return process.env.DEMO_LOGIN_ENABLED === 'true';
    }
    return process.env.DEMO_LOGIN_ENABLED !== 'false';
}

/**
 * Returns the configured demo parameters.
 */
function getDemoConfig() {
    const rawAdmin = process.env.DEMO_ADMIN_PHONE || '9999999999';
    const adminPhones = rawAdmin
        .split(',')
        .map(p => p.replace(/\D/g, '').slice(-10))
        .filter(p => p.length === 10);

    const rawPrincipal = process.env.DEMO_PRINCIPAL_PHONE || '8888888888';
    const principalPhones = rawPrincipal
        .split(',')
        .map(p => p.replace(/\D/g, '').slice(-10))
        .filter(p => p.length === 10);

    const demoOtp = (process.env.DEMO_OTP || '123456').trim();

    return {
        adminPhones,
        principalPhones,
        demoOtp
    };
}

/**
 * Determines if a login request qualifies for demo login.
 * STRICT CRITERIA:
 * 1. Demo login must be enabled.
 * 2. Role must NOT be 'staff' (Staff is strictly real SMS OTP only).
 * 3. Role must be 'admin' AND phone must match authorized DEMO_ADMIN_PHONE, OR
 *    Role must be 'hoi'/'principal' AND phone must match authorized DEMO_PRINCIPAL_PHONE.
 * 
 * @param {string} phone 
 * @param {string} role 
 * @returns {boolean}
 */
function isDemoLogin(phone, role) {
    if (!isDemoLoginEnabled()) return false;
    if (!phone || !role) return false;

    const roleNorm = role.toString().trim().toLowerCase();
    // CRITICAL: Staff members can NEVER use demo login under any circumstances
    if (roleNorm === 'staff') return false;

    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) return false;

    const config = getDemoConfig();

    if (roleNorm === 'admin') {
        return config.adminPhones.includes(cleanPhone);
    }

    if (roleNorm === 'hoi' || roleNorm === 'principal') {
        return config.principalPhones.includes(cleanPhone);
    }

    return false;
}

/**
 * Handles OTP dispatch simulation for authorized demo accounts.
 * Inserts the hashed demo OTP into SQLite with a 5-minute expiration window.
 * Does NOT invoke external SMS gateways or reveal the OTP code.
 * 
 * @param {string} phone 
 * @param {string} role 
 * @param {object} db - better-sqlite3 database instance
 * @returns {object} { success: boolean, message: string }
 */
function handleDemoSendOtp(phone, role, db) {
    if (!isDemoLogin(phone, role)) {
        return { success: false, error: 'Unauthorized demo login attempt.' };
    }

    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    const withPlus91 = '+91' + cleanPhone;
    const { demoOtp } = getDemoConfig();

    const hashedOtp = crypto.createHash('sha256').update(demoOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store in otps table (hashed for security, 5-minute expiry)
    db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(withPlus91, hashedOtp, expiresAt);
    db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(cleanPhone, hashedOtp, expiresAt);

    // Sync to attendance_otps for compatibility with attendance punch/status endpoints
    try {
        const userRow = db.prepare("SELECT employee_id FROM users WHERE phone = ? OR phone = ?").get(withPlus91, cleanPhone);
        if (userRow?.employee_id) {
            db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ? AND is_used = 0').run(userRow.employee_id);
            db.prepare('INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts) VALUES (?, ?, ?, 0, 0)').run(userRow.employee_id, hashedOtp, expiresAt);
        }
    } catch (syncErr) {
        // Non-fatal
    }

    return {
        success: true,
        message: 'OTP request submitted. Please check your registered mobile phone.'
    };
}

/**
 * Verifies demo OTP for authorized demo accounts.
 * Enforces attempt tracking and account lockout on 5 failed attempts.
 * 
 * @param {string} phone 
 * @param {string} role 
 * @param {string} otp 
 * @param {object} db - better-sqlite3 database instance
 * @returns {object|null} { success: boolean, locked?: boolean, error?: string } or null if not demo
 */
function verifyDemoOtp(phone, role, otp, db) {
    if (!isDemoLogin(phone, role)) {
        return null; // Not a demo login attempt; caller must proceed with real SMS OTP verification
    }

    const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
    const withPlus91 = '+91' + cleanPhone;
    const { demoOtp } = getDemoConfig();
    const cleanOtp = (otp || '').toString().trim();

    if (cleanOtp !== demoOtp) {
        try {
            const row = db.prepare('SELECT attempts FROM otps WHERE phone = ? OR phone = ?').get(withPlus91, cleanPhone);
            const attempts = ((row && row.attempts) || 0) + 1;
            db.prepare('UPDATE otps SET attempts = ? WHERE phone = ? OR phone = ?').run(attempts, withPlus91, cleanPhone);

            if (attempts >= 5) {
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                db.prepare('INSERT INTO auth_lockouts (identifier, locked_until, reason) VALUES (?, ?, ?)').run(
                    cleanPhone,
                    lockUntil,
                    'Exceeded 5 failed demo verification attempts'
                );
                db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(withPlus91, cleanPhone);
                return {
                    success: false,
                    locked: true,
                    error: 'Account locked for 15 minutes due to 5 consecutive failed verification attempts.'
                };
            }

            const remaining = 5 - attempts;
            return {
                success: false,
                error: `Invalid OTP. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`
            };
        } catch {
            return { success: false, error: 'Invalid OTP' };
        }
    }

    // Demo OTP matched successfully - cleanup single-use OTP rows
    try {
        db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(withPlus91, cleanPhone);
        const userRow = db.prepare("SELECT employee_id FROM users WHERE phone = ? OR phone = ?").get(withPlus91, cleanPhone);
        if (userRow?.employee_id) {
            db.prepare('DELETE FROM attendance_otps WHERE employee_id = ?').run(userRow.employee_id);
        }
    } catch (cleanupErr) {
        // Non-fatal
    }

    return { success: true };
}

module.exports = {
    isDemoLoginEnabled,
    getDemoConfig,
    isDemoLogin,
    handleDemoSendOtp,
    verifyDemoOtp
};
