const db = require('../database');
const jwt = require('jsonwebtoken');
const { sendVerification, checkVerification } = require('../utils/sms');

exports.login = async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const existingUser = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!existingUser) {
        return res.status(403).json({ error: 'Mobile number not found. Please register first.' });
    }

    let result;
    try {
        result = await sendVerification(phone);
        if (result.success) {
            const responseData = { success: true, message: 'Verification code sent successfully' };
            if (result.mock) {
                responseData.debug = "Running in MOCK mode. Set SMS_API_KEY in .env for real SMS. Use '123456' to verify.";
            }
            res.json(responseData);
        } else {
            console.error(`[SMS Delivery Error] Full details:`, result.error);
            res.status(502).json({ success: false, message: "Failed to deliver SMS" });
        }
    } catch (smsError) {
        console.error(`[SMS Gateway Exception] Full details:`, smsError);
        res.status(502).json({ success: false, message: "Failed to deliver SMS" });
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
        console.error('Registration error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.verify = async (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    // Use Twilio Verify to check the code
    const verifyResult = await checkVerification(phone, otp);

    if (!verifyResult.success) {
        return res.status(400).json({ error: verifyResult.error || 'Invalid OTP' });
    }

    // OTP is valid (approved by Twilio)
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        return res.status(403).json({ error: 'User does not exist. Please register first.' });
    }

    console.log('Logging in user:', user);

    // Generate JWT
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user, message: 'Login successful' });
};

exports.verifyToken = (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        res.json({
            message: 'Token is valid',
            user: user || req.user
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
