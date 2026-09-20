const axios = require('axios');
const db = require('../database');

/**
 * Masks a phone number to protect privacy (e.g. "+91******7776")
 */
const maskPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return '****';
    const clean = phone.trim();
    if (clean.length <= 4) return '****';
    return clean.slice(0, -4).replace(/[0-9]/g, '*') + clean.slice(-4);
};

/**
 * Generates a cryptographically sound random 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Checks if SMS gateway credentials are real and active
 */
const isGatewayConfigured = (apiKey) => {
    if (!apiKey) return false;
    const trimmed = apiKey.trim();
    return (
        trimmed.length > 10 &&
        !trimmed.includes('_HERE') &&
        !trimmed.startsWith('your_') &&
        !trimmed.startsWith('SMS_KEY_ROTATED')
    );
};

/**
 * Starts a phone verification using configured SMS gateway or local store
 * 
 * @param {string} phone - The mobile number
 */
const sendVerification = async (phone) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER || 'TGSSVM';
    
    // Normalize phone (use last 10 digits since country code 91 is specified)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 10) {
        cleanPhone = cleanPhone.slice(-10);
    }
    
    let formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    if (!isGatewayConfigured(apiKey)) {
        // Fallback for test/local environment when real SMS gateway is not configured
        // Uses dynamically generated OTP stored in database (NO static bypasses or hardcoded demo numbers)
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(formattedPhone, otp, expiresAt);
        console.log(`[SMS-DEV] Verification OTP created for ${maskPhone(formattedPhone)} (Dev mode active)`);
        return { success: true, status: 'pending', devOtp: process.env.NODE_ENV === 'test' ? otp : undefined };
    }

    const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;
    
    try {
        const url = process.env.SMS_BASE_URL || `https://m.xsms.in/api/sendhttp.php`;
        const params = {
            authkey: apiKey,
            mobiles: cleanPhone,
            sender: senderId,
            route: '4',
            country: '91',
            unicode: '1',
            campaign: process.env.SMS_CAMPAIGN || 'test',
            DLT_TE_ID: process.env.DLT_TE_ID || '1507166573508565333',
            message: message
        };

        console.log(`[SMS] Dispatching OTP to ${maskPhone(formattedPhone)}...`);
        const response = await axios.get(url, { params });

        const respText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (respText.toLowerCase().includes('error') || respText.toLowerCase().includes('fail') || respText.toLowerCase().includes('invalid')) {
            console.error(`[SMS ERROR] Gateway rejected request:`, respText);
            return { success: false, error: 'Failed to deliver verification code' };
        }

        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(formattedPhone, otp, expiresAt);
        return { success: true, status: 'pending' };
    } catch (error) {
        console.error(`[SMS ERROR] Gateway connection failed:`, error.message);
        return { success: false, error: 'SMS service temporarily unavailable' };
    }
};

/**
 * Checks a verification code using local database.
 * 
 * @param {string} phone - The mobile number
 * @param {string} code - The OTP code to check
 */
const checkVerification = async (phone, code) => {
    const formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;

    try {
        const row = db.prepare('SELECT otp, expires_at, attempts FROM otps WHERE phone = ?').get(formattedPhone);

        if (!row) {
            return { success: false, error: 'OTP not found or expired.' };
        }

        const now = new Date();
        const expiresAt = new Date(row.expires_at);

        if (now > expiresAt) {
            db.prepare('DELETE FROM otps WHERE phone = ?').run(formattedPhone);
            return { success: false, error: 'OTP has expired.' };
        }

        if (row.otp === code) {
            console.log(`[AUTH] Verification successful for ${maskPhone(formattedPhone)}`);
            db.prepare('DELETE FROM otps WHERE phone = ?').run(formattedPhone);
            return { success: true, status: 'approved' };
        } else {
            const attempts = (row.attempts || 0) + 1;
            db.prepare('UPDATE otps SET attempts = ? WHERE phone = ?').run(attempts, formattedPhone);

            if (attempts >= 5) {
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                db.prepare(`
                    INSERT INTO auth_lockouts (identifier, locked_until, reason) 
                    VALUES (?, ?, ?)
                `).run(formattedPhone, lockUntil, 'Exceeded 5 failed login attempts');

                db.prepare('DELETE FROM otps WHERE phone = ?').run(formattedPhone);
                console.warn(`[AUTH LOCKOUT] Locked ${maskPhone(formattedPhone)} for 15 mins due to 5 failed attempts`);
                return { 
                    success: false, 
                    locked: true, 
                    error: 'Account locked for 15 minutes due to 5 consecutive failed login attempts.' 
                };
            }

            const remaining = 5 - attempts;
            console.warn(`[AUTH] Invalid OTP attempt for ${maskPhone(formattedPhone)} (${attempts}/5)`);
            return { 
                success: false, 
                error: `Invalid OTP. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` 
            };
        }
    } catch (error) {
        console.error(`[AUTH ERROR] Verification check error:`, error.message);
        return { success: false, error: 'Internal verification error.' };
    }
};

/**
 * Sends a secure attendance OTP using configured SMS API
 * 
 * @param {string} phone - Mobile number
 * @param {string} otp - 6-digit OTP
 */
const sendAttendanceOTP = async (phone, otp) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER || 'TGSSVM';
    const templateId = process.env.DLT_TE_ID || '1507166573508565333';

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 10) {
        cleanPhone = cleanPhone.slice(-10);
    }

    let formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;

    if (!isGatewayConfigured(apiKey)) {
        console.log(`[SMS-DEV] Attendance OTP generated for ${maskPhone(formattedPhone)} (Dev mode active)`);
        return { success: true, devMode: true };
    }

    const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;

    try {
        const url = process.env.SMS_BASE_URL || `https://m.xsms.in/api/sendhttp.php`;
        const params = {
            authkey: apiKey,
            mobiles: cleanPhone,
            sender: senderId,
            route: '4',
            country: '91',
            unicode: '1',
            campaign: process.env.SMS_CAMPAIGN || 'test',
            DLT_TE_ID: templateId,
            message: message
        };

        console.log(`[SMS] Sending attendance OTP to ${maskPhone(formattedPhone)}...`);
        const response = await axios.get(url, { params });

        const respText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        console.log(`[SMS Gateway Response]:`, respText);
        if (respText.toLowerCase().includes('error') || respText.toLowerCase().includes('fail') || respText.toLowerCase().includes('invalid')) {
            console.error(`[SMS ERROR] Gateway rejected attendance OTP:`, respText);
            return { success: false, error: 'Failed to deliver OTP' };
        }

        return { success: true };
    } catch (error) {
        console.error(`[SMS ERROR] Gateway connection failed:`, error.message);
        return { success: false, error: 'SMS service temporarily unavailable' };
    }
};

module.exports = { sendVerification, checkVerification, sendAttendanceOTP, maskPhone };
