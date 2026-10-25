const db = require('../database');
const jwt = require('jsonwebtoken');
const { sendVerification, checkVerification, maskPhone } = require('../utils/sms');

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

    const existingUser = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?) AND status = 'active'").get(rawPhone, tenDigits, withPlus91);
    if (!existingUser) {
        return res.status(403).json({ error: 'Mobile number not found. Please register first.' });
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
        if (!firstName || !mobile) {
            return res.status(400).json({ error: 'First name and mobile are required' });
        }

        const name = `${firstName} ${lastName}`.trim();
        const cleanEmpId = employeeId && employeeId.trim() !== '' ? employeeId.trim() : `EMP-${mobile.replace(/\D/g, '')}`;

        // Check if user already exists
        const existingUser = db.prepare('SELECT * FROM users WHERE phone = ? OR (employee_id = ? AND employee_id IS NOT NULL)').get(mobile, cleanEmpId);
        if (existingUser) {
            return res.status(409).json({ error: 'A user with this mobile number or employee ID already exists. Please log in.' });
        }

        db.prepare('INSERT INTO users (phone, name, college, department, role, employee_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(mobile, name, collegeName, departmentName, 'staff', cleanEmpId, 'active');
        res.json({ message: 'Registration successful!' });
    } catch (err) {
        console.error('Registration error:', err.message || err);
        res.status(500).json({ error: err.message || 'Registration failed' });
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

    let user = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?) AND status = 'active'").get(rawPhone, tenDigits, withPlus91);
    if (!user) {
        return res.status(403).json({ error: 'User does not exist. Please register first.' });
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

    res.json({ token, user, success: true, otpVerified: true, message: 'Login successful' });
};

exports.verifyToken = (req, res) => {
    try {
        const user = db.prepare('SELECT id, name, phone, role, college, department, employee_id, status FROM users WHERE id = ?').get(req.user.id);
        res.json({
            message: 'Token is valid',
            user: user || req.user
        });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Token verification failed' });
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
        console.error('Error updating profile:', err.message || err);
        res.status(500).json({ error: err.message || 'Failed to update profile' });
    }
};
