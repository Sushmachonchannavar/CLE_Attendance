const db = require('../database');
const jwt = require('jsonwebtoken');
const { sendVerification, checkVerification, maskPhone } = require('../utils/sms');
const { getAuthCookieOptions, getClearCookieOptions } = require('../utils/cookies');

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

    if (existingUser.status === 'pending') {
        return res.status(403).json({ error: 'Your account is pending administrator approval. Please contact the administrator.' });
    }

    if (existingUser.status !== 'active') {
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

    try {
        const result = await sendVerification(phone);
        if (result.success) {
            return res.json({ 
                success: true, 
                message: 'OTP request submitted. Please check your registered mobile phone.'
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
        const { firstName, lastName, mobile, collegeName, departmentName, employeeId } = req.body;
        
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

        // 3. Insert new user strictly with status 'pending'
        db.prepare(`
            INSERT INTO users (phone, name, college, department, role, employee_id, status) 
            VALUES (?, ?, ?, ?, 'staff', ?, 'pending')
        `).run(tenDigits, fullName, cleanCollege, cleanDept, cleanEmpId);

        console.log(`[AUTH] New user registration submitted: ${fullName} (${tenDigits}, status: pending)`);

        return res.status(201).json({
            success: true,
            message: 'Registration submitted successfully. Your account is pending administrator approval before you can log in.'
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

    if (user.status === 'pending') {
        return res.status(403).json({ error: 'Your account is pending administrator approval. Please contact the administrator.' });
    }

    if (user.status !== 'active') {
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

    const verifyResult = await checkVerification(phone, otp);

    if (!verifyResult.success) {
        const statusCode = verifyResult.locked ? 423 : 400;
        return res.status(statusCode).json({ error: verifyResult.error || 'Invalid OTP' });
    }

    console.log(`[AUTH] Login successful for user ID: ${user.id} (${maskPhone(user.phone)})`);

    // Generate JWT
    const token = jwt.sign(
        { id: user.id, role: user.role, employeeId: user.employee_id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
    );

    // Set secure HTTP-only session cookie
    try {
        res.cookie('token', token, getAuthCookieOptions());
    } catch (cookieErr) {
        console.warn('[AUTH] Could not set cookie header:', cookieErr.message);
    }

    res.json({ token, user, success: true, otpVerified: true, message: 'Login successful' });
};

exports.verifyToken = (req, res) => {
    try {
        const user = db.prepare('SELECT id, name, phone, role, college, department, employee_id, status FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(401).json({ error: 'User account no longer exists.' });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'User account is not active.' });
        }
        res.json({
            message: 'Token is valid',
            user: user
        });
    } catch (err) {
        console.error('Token verification error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Token verification failed.' });
    }
};

exports.logout = (req, res) => {
    try {
        res.clearCookie('token', getClearCookieOptions());
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
        console.error('Logout error:', err.stack || err.message || err);
        res.status(500).json({ error: 'Logout failed.' });
    }
};

exports.updateProfile = (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.user.id;
        const { name, department, college } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Full name is required' });
        }

        const trimmedName = name.trim();
        const trimmedDepartment = typeof department === 'string' ? department.trim() : '';
        const trimmedCollege = typeof college === 'string' ? college.trim() : '';

        db.prepare(`
            UPDATE users 
            SET name = ?, department = ?, college = ?
            WHERE id = ?
        `).run(trimmedName, trimmedDepartment, trimmedCollege, userId);

        const updatedUser = db.prepare('SELECT id, name, phone, role, college, department, employee_id, status FROM users WHERE id = ?').get(userId);

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (err) {
        console.error('Error updating profile:', err.stack || err.message || err);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
};
