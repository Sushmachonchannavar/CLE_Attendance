const db = require('../database');
const jwt = require('jsonwebtoken');
const { sendVerification, checkVerification, maskPhone } = require('../utils/sms');

const DEMO_PHONE_MAP = {
    '9999999999': { role: 'admin', otp: '123456', name: 'Admin Demo' },
    '8888888888': { role: 'hoi', otp: '123456', name: 'Principal Demo' },
    '9876543210': { role: 'staff', otp: '123456', name: 'Faculty Staff Demo' },
    '1234567890': { role: 'staff', otp: '123456', name: 'Staff Demo' }
};

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
    const { phone } = req.body;
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

    const existingUser = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?) AND status = 'active'").get(rawPhone, tenDigits, withPlus91);
    if (!existingUser) {
        return res.status(403).json({ error: 'Mobile number not found. Please register first.' });
    }

    if (DEMO_PHONE_MAP[tenDigits]) {
        const demoOtp = DEMO_PHONE_MAP[tenDigits].otp;
        return res.json({ 
            success: true, 
            message: `Demo verification code ready. Enter OTP: ${demoOtp}`,
            isDemo: true,
            devOtp: demoOtp
        });
    }

    try {
        const result = await sendVerification(phone);
        if (result.success) {
            res.json({ 
                success: true, 
                message: 'Verification code sent successfully',
                devOtp: result.devOtp
            });
        } else {
            res.status(502).json({ success: false, message: result.error || 'Failed to deliver SMS' });
        }
    } catch (smsError) {
        console.error('[SMS ERROR] Exception occurred during verification dispatch');
        res.status(502).json({ success: false, message: 'Failed to deliver SMS' });
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
            // Update existing user's name, college, department, and employeeId
            db.prepare('UPDATE users SET name = ?, college = ?, department = ?, employee_id = ? WHERE phone = ? OR employee_id = ?')
                .run(name, collegeName, departmentName, cleanEmpId, mobile, cleanEmpId);
            return res.json({ message: 'Profile updated successfully' });
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
    const { phone, otp } = req.body;
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

    const isDemoMatch = DEMO_PHONE_MAP[tenDigits] && otp.trim() === DEMO_PHONE_MAP[tenDigits].otp;

    if (!isDemoMatch) {
        const verifyResult = await checkVerification(phone, otp);

        if (!verifyResult.success) {
            const statusCode = verifyResult.locked ? 423 : 400;
            return res.status(statusCode).json({ error: verifyResult.error || 'Invalid OTP' });
        }
    }

    let user = db.prepare("SELECT * FROM users WHERE (phone = ? OR phone = ? OR phone = ?) AND status = 'active'").get(rawPhone, tenDigits, withPlus91);
    if (!user) {
        return res.status(403).json({ error: 'User does not exist. Please register first.' });
    }

    console.log(`[AUTH] Login successful for user ID: ${user.id} (${maskPhone(user.phone)})`);

    // Generate JWT
    const token = jwt.sign(
        { id: user.id, role: user.role, employeeId: user.employee_id }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
    );

    res.json({ token, user, message: 'Login successful' });
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
