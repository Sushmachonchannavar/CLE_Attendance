const db = require('../database');
const jwt = require('jsonwebtoken');
const { sendVerification, checkVerification } = require('../utils/sms');

exports.login = async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const result = await sendVerification(phone);

    if (result.success) {
        const responseData = { message: 'Verification code sent successfully' };
        if (result.mock) {
            responseData.debug = "Running in MOCK mode. Set TWILIO_AUTH_TOKEN in .env for real SMS. Use '123456' to verify.";
        }
        res.json(responseData);
    } else {
        res.status(500).json({ error: 'Failed to send verification code', details: result.error });
    }
};

exports.register = (req, res) => {
    try {
        const { firstName, lastName, mobile, collegeName, departmentName } = req.body;
        if (!firstName || !mobile) {
            return res.status(400).json({ error: 'First name and mobile are required' });
        }

        const name = `${firstName} ${lastName}`.trim();

        // Check if user already exists
        const existingUser = db.prepare('SELECT * FROM users WHERE phone = ?').get(mobile);
        if (existingUser) {
            // Update existing user's name, college and department
            db.prepare('UPDATE users SET name = ?, college = ?, department = ? WHERE phone = ?').run(name, collegeName, departmentName, mobile);
            return res.json({ message: 'Profile updated successfully' });
        }

        db.prepare('INSERT INTO users (phone, name, college, department, role) VALUES (?, ?, ?, ?, ?)').run(mobile, name, collegeName, departmentName, 'staff');
        res.json({ message: 'Registration successful' });
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
    // Check if user exists, if not create one
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
        const info = db.prepare('INSERT INTO users (phone, name) VALUES (?, ?)').run(phone, 'New User');
        user = { id: info.lastInsertRowid, phone, role: 'staff', name: 'New User' };
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
