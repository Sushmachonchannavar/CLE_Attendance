const db = require('../database');
const jwt = require('jsonwebtoken');
const { sendVerification, checkVerification, maskPhone } = require('../utils/sms');
const { 
    getAuthCookieOptions, 
    getClearCookieOptions, 
    getRefreshCookieOptions, 
    getClearRefreshCookieOptions 
} = require('../utils/cookies');
const { 
    isDemoLogin, 
    handleDemoSendOtp, 
    verifyDemoOtp,
    isDemoLoginEnabled,
    getDemoConfig
} = require('../utils/demoAuth');
const sessionManager = require('../utils/sessionManager');

// Institutional Administrator constant phone number (Real Admin)
const ADMIN_CONSTANT_PHONE = (process.env.ADMIN_PHONE || '9448378417').trim();

// Configured Demo Admin phone number (defaults to 9999999999)
const getDemoAdminPhone = () => {
    try {
        const config = getDemoConfig();
        return (config.demoAdminPhone || '9999999999').replace(/\D/g, '').slice(-10);
    } catch {
        return (process.env.DEMO_ADMIN_PHONE || '9999999999').replace(/\D/g, '').slice(-10);
    }
};

const getJwtSecret = () => process.env.JWT_SECRET || 'cle_secret_key_minimum_32_characters_prod_fallback';

// In-memory rate limiting for login OTP requests (Max 5 requests per 10 minutes)
const loginAttemptsMap = new Map();
function checkLoginRateLimit(identifier) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const history = loginAttemptsMap.get(identifier) || [];
    const validHistory = history.filter(ts => now - ts < windowMs);
    if (validHistory.length >= 5) {
        return false;
    }
    validHistory.push(now);
    loginAttemptsMap.set(identifier, validHistory);
    return true;
}

/**
 * Checks if an identifier is locked out in auth_lockouts
 */
function checkLockout(identifier) {
    if (!identifier) return null;
    try {
        return db.prepare(`
            SELECT locked_until, reason 
            FROM auth_lockouts 
            WHERE identifier = ? AND locked_until > datetime('now')
            ORDER BY locked_until DESC 
            LIMIT 1
        `).get(identifier) || null;
    } catch (e) {
        return null;
    }
}

exports.login = async (req, res) => {
    const { phone, role } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const rawPhone = phone.trim();
    const digits = rawPhone.replace(/\D/g, '');
    const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
    const withPlus91 = '+91' + tenDigits;

    // Check account lockout
    const lockout = checkLockout(rawPhone) || checkLockout(withPlus91) || checkLockout(tenDigits);
    if (lockout) {
        const lockTime = new Date(lockout.locked_until).toLocaleTimeString();
        return res.status(423).json({
            error: `Account is temporarily locked due to multiple failed verification attempts. Locked until: ${lockTime}`
        });
    }

    // Rate limiting check
    if (!checkLoginRateLimit(tenDigits)) {
        return res.status(429).json({ error: 'Too many OTP requests. Please try again after 10 minutes.' });
    }

    const existingUser = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?)").get(rawPhone, tenDigits, withPlus91);
    if (!existingUser) {
        return res.status(403).json({ error: 'Mobile number not found. Please register first.' });
    }

    if (existingUser.status !== 'active' && existingUser.status !== 'approved') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact the administrator.' });
    }

    // Validate user role matches the selected role
    if (role) {
        const dbRole = existingUser.role?.toLowerCase();
        const targetRole = role.toLowerCase();
        const rolesMatch = dbRole === targetRole || 
                           ((dbRole === 'hoi' || dbRole === 'principal') && 
                            (targetRole === 'hoi' || targetRole === 'principal'));
        if (!rolesMatch) {
            const displayRole = (targetRole === 'hoi' || targetRole === 'principal') ? 'Principal' : targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
            console.warn('[AUTH FAILED] Role mismatch for user:', { phone: maskPhone(phone), dbRole, targetRole });
            return res.status(403).json({ error: `User is not registered as ${displayRole}.` });
        }
    }

    // Strictly enforce Administrator access: only real Admin (9448378417) or authorized demo Admin (9999999999) can access Admin
    const adminTenDigits = ADMIN_CONSTANT_PHONE.replace(/\D/g, '').slice(-10);
    const demoAdminDigits = getDemoAdminPhone();
    const isAuthorizedAdmin = tenDigits === adminTenDigits || (isDemoLoginEnabled() && tenDigits === demoAdminDigits);

    if ((role && role.toLowerCase() === 'admin') || (existingUser.role && existingUser.role.toLowerCase() === 'admin')) {
        if (!isAuthorizedAdmin) {
            console.warn('[AUTH FAILED] Unauthorized admin access attempt:', { phone: maskPhone(phone), role });
            return res.status(403).json({ error: 'This mobile number is not authorized for administrator access.' });
        }
    }

    // Check if authorized demo login applies (Demo Admin 9999999999 or Demo Principal 8888888888)
    if (isDemoLogin(tenDigits, role)) {
        console.log(`[AUTH DEMO] Demo OTP initiated for authorized ${role} user: ${maskPhone(phone)}`);
        const demoRes = handleDemoSendOtp(tenDigits, role, db);
        return res.json(demoRes);
    }

    try {
        const result = await sendVerification(phone);
        if (result.success) {
            // Never expose real Admin OTP in API responses under any circumstances
            const isRealAdmin = tenDigits === adminTenDigits;
            const includeTestOtp = process.env.NODE_ENV === 'test' && result.testOtp && !isRealAdmin;
            return res.json({ 
                success: true, 
                message: 'OTP request submitted. Please check your registered mobile phone.',
                ...(includeTestOtp ? { testOtp: result.testOtp } : {})
            });
        } else {
            console.error(`[AUTH SMS Gateway Unavailable] Delivery failed for ${maskPhone(phone)}:`, result.error);
            return res.status(503).json({ 
                success: false, 
                error: result.error && !result.error.includes('credentials')
                    ? result.error
                    : 'SMS service is temporarily unavailable. Please verify mobile reception or try again shortly.'
            });
        }
    } catch (smsError) {
        console.error('[SMS ERROR] Exception occurred during verification dispatch:', smsError.message);
        return res.status(503).json({ 
            success: false, 
            error: 'SMS service is temporarily unavailable. Please verify mobile reception or try again shortly.'
        });
    }
};

exports.register = (req, res) => {
    try {
        const { firstName, lastName, mobile, collegeName, departmentName, designation, employeeId } = req.body;
        
        // 1. Input validation
        if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
            return res.status(400).json({ error: 'First name is required and must be at least 2 characters.' });
        }
        if (firstName.trim().length > 50) {
            return res.status(400).json({ error: 'First name cannot exceed 50 characters.' });
        }

        const cleanFirst = firstName.trim();
        const cleanLast = lastName && typeof lastName === 'string' ? lastName.trim() : '';
        if (cleanLast.length > 50) {
            return res.status(400).json({ error: 'Last name cannot exceed 50 characters.' });
        }
        const fullName = cleanLast ? `${cleanFirst} ${cleanLast}` : cleanFirst;

        if (!mobile || typeof mobile !== 'string') {
            return res.status(400).json({ error: 'Mobile number is required.' });
        }
        const rawDigits = mobile.replace(/\D/g, '');
        const tenDigits = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
        if (tenDigits.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigits)) {
            return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
        }

        let cleanEmpId = null;
        if (employeeId && typeof employeeId === 'string' && employeeId.trim() !== '') {
            cleanEmpId = employeeId.trim().toUpperCase();
            if (!/^[A-Z0-9_-]{3,30}$/.test(cleanEmpId)) {
                return res.status(400).json({ error: 'Employee ID must be 3-30 alphanumeric characters, hyphens, or underscores.' });
            }
        } else {
            cleanEmpId = `EMP-${tenDigits}`;
        }

        const cleanCollege = collegeName && typeof collegeName === 'string' ? collegeName.trim().slice(0, 100) : '';
        const cleanDept = departmentName && typeof departmentName === 'string' ? departmentName.trim().slice(0, 100) : '';
        const cleanDesignation = designation && typeof designation === 'string' && designation.trim() 
            ? designation.trim().slice(0, 100) 
            : 'Faculty Member';

        // 2. Conflict check (Never update an existing user; return 409 if exists)
        const withPlus91 = '+91' + tenDigits;
        const existing = db.prepare(`
            SELECT id, status FROM users 
            WHERE phone = ? OR phone = ? OR phone = ? OR employee_id = ?
        `).get(mobile.trim(), tenDigits, withPlus91, cleanEmpId);

        if (existing) {
            return res.status(409).json({ 
                error: 'A user with this mobile number or employee ID already exists. Please log in.' 
            });
        }

        // 3. Insert new user strictly with status 'active' (auto-activated, no approval required)
        db.prepare(`
            INSERT INTO users (phone, name, college, department, designation, role, employee_id, status) 
            VALUES (?, ?, ?, ?, ?, 'staff', ?, 'active')
        `).run(tenDigits, fullName, cleanCollege, cleanDept, cleanDesignation, cleanEmpId);

        // Commit immediately to disk and update recovery snapshot
        if (typeof db.checkpoint === 'function') db.checkpoint();
        if (typeof db.createBackup === 'function') {
            db.createBackup('registration').catch(() => {});
        }

        console.log(`[AUTH] New user registration completed: ${fullName} (${tenDigits}, status: active)`);

        return res.status(201).json({
            success: true,
            message: 'Registration completed successfully! You can now log in using your registered mobile number.'
        });
    } catch (err) {
        console.error('Registration error:', err.stack || err.message || err);
        return res.status(500).json({ error: 'Registration failed due to an internal server error.' });
    }
};

exports.verify = async (req, res) => {
    const { phone, otp, role } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    const rawPhone = phone.trim();
    const digits = rawPhone.replace(/\D/g, '');
    const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
    const withPlus91 = '+91' + tenDigits;

    // Check account lockout
    const lockout = checkLockout(rawPhone) || checkLockout(withPlus91) || checkLockout(tenDigits);
    if (lockout) {
        const lockTime = new Date(lockout.locked_until).toLocaleTimeString();
        return res.status(423).json({
            error: `Account is temporarily locked due to multiple failed verification attempts. Locked until: ${lockTime}`
        });
    }

    let user = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?)").get(rawPhone, tenDigits, withPlus91);
    if (!user) {
        return res.status(403).json({ error: 'User does not exist. Please register first.' });
    }

    if (user.status !== 'active' && user.status !== 'approved') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact the administrator.' });
    }

    // Validate user role matches the selected role
    if (role) {
        const dbRole = user.role?.toLowerCase();
        const targetRole = role.toLowerCase();
        const rolesMatch = dbRole === targetRole || 
                           ((dbRole === 'hoi' || dbRole === 'principal') && 
                            (targetRole === 'hoi' || targetRole === 'principal'));
        if (!rolesMatch) {
            const displayRole = (targetRole === 'hoi' || targetRole === 'principal') ? 'Principal' : targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
            console.warn('[AUTH VERIFY FAILED] Role mismatch for user:', { phone: maskPhone(phone), dbRole, targetRole });
            return res.status(403).json({ error: `User is not registered as ${displayRole}.` });
        }
    }

    // Strictly enforce Administrator access: only real Admin (9448378417) or authorized demo Admin (9999999999) can access Admin
    const adminTenDigits = ADMIN_CONSTANT_PHONE.replace(/\D/g, '').slice(-10);
    const demoAdminDigits = getDemoAdminPhone();
    const isAuthorizedAdmin = tenDigits === adminTenDigits || (isDemoLoginEnabled() && tenDigits === demoAdminDigits);

    if ((role && role.toLowerCase() === 'admin') || (user.role && user.role.toLowerCase() === 'admin')) {
        if (!isAuthorizedAdmin) {
            console.warn('[AUTH VERIFY FAILED] Unauthorized admin access attempt:', { phone: maskPhone(phone), role });
            return res.status(403).json({ error: 'This mobile number is not authorized for administrator access.' });
        }
    }

    let verifyResult;
    if (isDemoLogin(tenDigits, role)) {
        console.log(`[AUTH DEMO] Verifying demo OTP for authorized ${role} user: ${maskPhone(phone)}`);
        verifyResult = verifyDemoOtp(tenDigits, role, otp, db);
    } else {
        // Admin, Staff, and production: strictly verified against real SMS OTP gateway
        verifyResult = await checkVerification(phone, otp);
    }

    if (!verifyResult.success) {
        const statusCode = verifyResult.locked ? 423 : 400;
        return res.status(statusCode).json({ error: verifyResult.error || 'Invalid OTP' });
    }

    console.log(`[AUTH] Login successful for user ID: ${user.id} (${maskPhone(user.phone)})`);

    // Extract device metadata for multi-device session management
    const clientDeviceId = req.body?.deviceId || (req.headers && (req.headers['x-device-id'] || req.headers['X-Device-Id'])) || null;
    const deviceInfo = req.body?.deviceInfo || {};
    const ip = req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])) || req.socket?.remoteAddress || '';
    const userAgent = (req.headers && (req.headers['user-agent'] || req.headers['User-Agent'])) || '';

    // Create a new persistent session and trusted device record in SQLite
    let sessionRecord;
    try {
        sessionRecord = sessionManager.createSession(db, {
            userId: user.id,
            deviceId: clientDeviceId,
            deviceInfo,
            ip,
            userAgent
        });
    } catch (sessionErr) {
        console.error('[AUTH] Could not create session record:', sessionErr.message);
    }

    // Generate JWT access token with session and device metadata
    const token = jwt.sign(
        { 
            id: user.id, 
            role: user.role, 
            employeeId: user.employee_id, 
            phone: user.phone,
            sessionId: sessionRecord ? sessionRecord.sessionId : null,
            deviceId: sessionRecord ? sessionRecord.deviceId : clientDeviceId
        }, 
        getJwtSecret(), 
        { expiresIn: '1d' } // Access token valid for 1 day, seamlessly refreshed via 30-day refresh token
    );

    // Set secure HTTP-only session cookies
    try {
        res.cookie('token', token, getAuthCookieOptions());
        if (sessionRecord?.refreshToken) {
            res.cookie('refreshToken', sessionRecord.refreshToken, getRefreshCookieOptions());
        }
    } catch (cookieErr) {
        console.warn('[AUTH] Could not set cookie headers:', cookieErr.message);
    }

    res.json({ 
        token, 
        refreshToken: sessionRecord?.refreshToken || null,
        deviceId: sessionRecord?.deviceId || clientDeviceId,
        user, 
        success: true, 
        otpVerified: true, 
        message: 'Login successful' 
    });
};

exports.refreshToken = async (req, res) => {
    try {
        const rawRefreshToken = req.cookies?.refreshToken || (req.headers && (req.headers['x-refresh-token'] || req.headers['X-Refresh-Token'])) || req.body?.refreshToken;
        const deviceId = (req.headers && (req.headers['x-device-id'] || req.headers['X-Device-Id'])) || req.cookies?.deviceId || req.body?.deviceId;
        const ip = req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])) || req.socket?.remoteAddress || '';
        const userAgent = (req.headers && (req.headers['user-agent'] || req.headers['User-Agent'])) || '';

        if (!rawRefreshToken || typeof rawRefreshToken !== 'string' || !rawRefreshToken.trim()) {
            return res.status(401).json({ error: 'No refresh token provided.', code: 'NO_REFRESH_TOKEN' });
        }

        const result = sessionManager.verifyAndRotateSession(db, {
            rawRefreshToken: rawRefreshToken.trim(),
            deviceId,
            ip,
            userAgent
        });

        if (!result.valid) {
            res.clearCookie('token', getClearCookieOptions());
            res.clearCookie('refreshToken', getClearRefreshCookieOptions());
            return res.status(401).json({ 
                error: result.error || 'Session expired or revoked.',
                code: result.code || 'SESSION_EXPIRED'
            });
        }

        // Generate newly refreshed JWT access token
        const token = jwt.sign(
            { 
                id: result.user.id, 
                role: result.user.role, 
                employeeId: result.user.employee_id, 
                phone: result.user.phone,
                sessionId: result.sessionId,
                deviceId: result.deviceId
            },
            getJwtSecret(),
            { expiresIn: '1d' }
        );

        try {
            res.cookie('token', token, getAuthCookieOptions());
            res.cookie('refreshToken', result.newRefreshToken, getRefreshCookieOptions());
        } catch (cookieErr) {
            console.warn('[AUTH REFRESH] Could not set cookies:', cookieErr.message);
        }

        console.log(`[AUTH REFRESH] Session rotated successfully for user ID ${result.user.id} on device ${result.deviceId}`);

        return res.json({
            success: true,
            token,
            refreshToken: result.newRefreshToken,
            deviceId: result.deviceId,
            user: result.user
        });
    } catch (err) {
        console.error('[AUTH REFRESH] Error refreshing session:', err.stack || err.message || err);
        return res.status(500).json({ error: 'Failed to refresh authentication session.' });
    }
};

exports.verifyToken = (req, res) => {
    try {
        let user = db.prepare('SELECT id, name, phone, role, college, department, designation, employee_id, status FROM users WHERE id = ?').get(req.user.id);
        if (!user && req.user.employeeId) {
            user = db.prepare('SELECT id, name, phone, role, college, department, designation, employee_id, status FROM users WHERE employee_id = ?').get(req.user.employeeId);
        }
        if (!user && req.user.phone) {
            const cleanPhone = req.user.phone.replace(/\D/g, '').slice(-10);
            user = db.prepare('SELECT id, name, phone, role, college, department, designation, employee_id, status FROM users WHERE phone LIKE ?').get(`%${cleanPhone}%`);
        }
        if (!user) {
            return res.status(401).json({ error: 'User account no longer exists.' });
        }
        if (user.status !== 'active' && user.status !== 'approved') {
            return res.status(403).json({ error: 'User account is not active.' });
        }
        const token = jwt.sign(
            { 
                id: user.id, 
                role: user.role, 
                employeeId: user.employee_id, 
                phone: user.phone,
                sessionId: req.user.sessionId || null,
                deviceId: req.user.deviceId || null
            },
            getJwtSecret(),
            { expiresIn: '1d' }
        );
        res.json({
            message: 'Token is valid',
            user: user,
            token: token
        });
    } catch (err) {
        console.error('Token verification error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Token verification failed.' });
    }
};

exports.logout = (req, res) => {
    try {
        const userId = req.user?.id;
        const deviceId = req.user?.deviceId || (req.headers && (req.headers['x-device-id'] || req.headers['X-Device-Id'])) || req.body?.deviceId;
        const sessionId = req.user?.sessionId;

        // Revoke ONLY the current device's session in SQLite so other devices stay safely logged in
        if (sessionId && userId) {
            sessionManager.revokeSession(db, userId, sessionId);
        } else if (deviceId && userId) {
            sessionManager.revokeDeviceSession(db, userId, deviceId);
        }

        res.clearCookie('token', getClearCookieOptions());
        res.clearCookie('refreshToken', getClearRefreshCookieOptions());
        res.json({ success: true, message: 'Logged out successfully from this device.' });
    } catch (err) {
        console.error('Logout error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Logout failed.' });
    }
};

exports.logoutAll = (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        sessionManager.revokeAllSessions(db, userId);

        res.clearCookie('token', getClearCookieOptions());
        res.clearCookie('refreshToken', getClearRefreshCookieOptions());
        res.json({ success: true, message: 'Logged out from all devices successfully.' });
    } catch (err) {
        console.error('Logout all error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Logout all failed.' });
    }
};

exports.getSessions = (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const currentDeviceId = req.user?.deviceId || (req.headers && (req.headers['x-device-id'] || req.headers['X-Device-Id'])) || '';
        const currentSessionId = req.user?.sessionId || null;
        const sessions = sessionManager.getUserSessions(db, userId, currentDeviceId, currentSessionId);

        res.json({ success: true, sessions });
    } catch (err) {
        console.error('Get sessions error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Failed to retrieve active sessions.' });
    }
};

exports.revokeSession = (req, res) => {
    try {
        const userId = req.user?.id;
        const sessionId = req.params.id;
        if (!userId || !sessionId) {
            return res.status(400).json({ error: 'Session ID is required.' });
        }

        const success = sessionManager.revokeSession(db, userId, sessionId);
        res.json({ 
            success, 
            message: success ? 'Device session revoked successfully.' : 'Session not found or already revoked.' 
        });
    } catch (err) {
        console.error('Revoke session error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Failed to revoke session.' });
    }
};

exports.revokeOtherSessions = (req, res) => {
    try {
        const userId = req.user?.id;
        const currentDeviceId = req.user?.deviceId || req.headers['x-device-id'] || '';
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const count = sessionManager.revokeOtherSessions(db, userId, currentDeviceId);
        res.json({ 
            success: true, 
            count, 
            message: `Logged out from ${count} other device(s).` 
        });
    } catch (err) {
        console.error('Revoke other sessions error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Failed to revoke other sessions.' });
    }
};

exports.updateProfile = (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
        }

        const userId = req.user.id;
        const { name, department, college, designation } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Official Full Name is required.' });
        }

        const trimmedName = name.trim();
        const trimmedDepartment = typeof department === 'string' ? department.trim() : '';
        const trimmedCollege = typeof college === 'string' ? college.trim() : '';
        const trimmedDesignation = typeof designation === 'string' ? designation.trim() : null;

        // Find target user by id, employeeId, or phone
        let targetId = req.user.id;
        if (req.user.role === 'admin' && req.body.targetUserId) {
            targetId = req.body.targetUserId;
        } else if (req.user.role === 'admin' && req.body.targetRole === 'hoi') {
            const pUser = db.prepare("SELECT id FROM users WHERE LOWER(role) IN ('hoi', 'principal')").get();
            if (pUser) targetId = pUser.id;
        }

        let targetUser = db.prepare('SELECT id, phone, role, employee_id FROM users WHERE id = ?').get(targetId);
        if (!targetUser && req.user.employeeId) {
            targetUser = db.prepare('SELECT id, phone, role, employee_id FROM users WHERE employee_id = ?').get(req.user.employeeId);
        }
        if (!targetUser && req.user.phone) {
            const cleanPhone = req.user.phone.replace(/\D/g, '').slice(-10);
            targetUser = db.prepare('SELECT id, phone, role, employee_id FROM users WHERE phone LIKE ?').get(`%${cleanPhone}%`);
        }

        if (!targetUser) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        targetId = targetUser.id;

        if (designation !== undefined) {
            db.prepare(`
                UPDATE users 
                SET name = ?, department = ?, college = ?, designation = ?
                WHERE id = ?
            `).run(trimmedName, trimmedDepartment, trimmedCollege, trimmedDesignation, targetId);
        } else {
            db.prepare(`
                UPDATE users 
                SET name = ?, department = ?, college = ?
                WHERE id = ?
            `).run(trimmedName, trimmedDepartment, trimmedCollege, targetId);
        }

        // Force SQLite WAL checkpoint to ensure persistent write directly to database file
        try {
            db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (walErr) {
            console.warn('[AUTH] Checkpoint warning:', walErr.message);
        }

        const updatedUser = db.prepare(`
            SELECT id, name, phone, role, college, department, designation, employee_id, status 
            FROM users 
            WHERE id = ?
        `).get(targetId);

        // Generate refreshed JWT token to keep client session fresh
        const token = jwt.sign(
            { id: updatedUser.id, role: updatedUser.role, employeeId: updatedUser.employee_id, phone: updatedUser.phone },
            getJwtSecret(),
            { expiresIn: '7d' }
        );

        try {
            res.cookie('token', token, getAuthCookieOptions());
        } catch (cookieErr) {
            console.warn('[AUTH] Could not set cookie header:', cookieErr.message);
        }

        console.log(`[PROFILE UPDATE] Successfully updated profile for user ID ${targetId} (${updatedUser.name})`);

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser,
            token
        });
    } catch (err) {
        console.error('Error updating profile:', err.stack || err.message || err);
        return res.status(500).json({ error: 'Failed to update profile.' });
    }
};

exports.ADMIN_CONSTANT_PHONE = ADMIN_CONSTANT_PHONE;

