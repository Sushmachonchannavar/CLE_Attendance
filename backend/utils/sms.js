const axios = require('axios');
const crypto = require('crypto');
const twilio = require('twilio');
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
    return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Checks if Twilio Verify credentials are valid and present
 */
const isTwilioConfigured = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    if (!accountSid || !serviceSid) return false;
    if (accountSid.startsWith('your_') || serviceSid.startsWith('your_')) return false;

    const hasAuthToken = authToken && !authToken.startsWith('your_') && authToken.trim().length > 10;
    const hasApiKey = apiKey && apiSecret && !apiKey.startsWith('your_') && !apiSecret.startsWith('your_') && apiKey.trim().length > 10 && apiSecret.trim().length > 10;

    return Boolean(hasAuthToken || hasApiKey);
};

/**
 * Creates and returns an authenticated Twilio client instance
 */
const getTwilioClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    if (authToken && !authToken.startsWith('your_') && authToken.trim().length > 10) {
        return twilio(accountSid.trim(), authToken.trim());
    }
    if (apiKey && apiSecret && !apiKey.startsWith('your_')) {
        return twilio(apiKey.trim(), apiSecret.trim(), { accountSid: accountSid.trim() });
    }
    return null;
};

/**
 * Checks if SMS gateway (XSMS) credentials are real and active
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
 * Starts a phone verification using configured SMS provider (Twilio Verify or XSMS gateway)
 * 
 * @param {string} phone - The mobile number
 */
const sendVerification = async (phone) => {
    // Normalize phone (ensure 10 digits for Indian mobile numbers)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 10) {
        cleanPhone = cleanPhone.slice(-10);
    }
    const formattedPhone = '+91' + cleanPhone;

    // 1. If Twilio Verify is configured, attempt dispatch via Twilio Verify V2 API
    if (isTwilioConfigured()) {
        try {
            const client = getTwilioClient();
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID.trim();
            console.log(`[SMS] Attempting Twilio Verify dispatch for ${maskPhone(formattedPhone)}...`);
            const verification = await client.verify.v2.services(serviceSid)
                .verifications
                .create({ to: formattedPhone, channel: 'sms' });

            if (verification.status === 'pending' || verification.status === 'approved') {
                console.log(`[SMS] Twilio Verify dispatched successfully to ${maskPhone(formattedPhone)} (SID: ${verification.sid})`);
                return { success: true, provider: 'twilio' };
            }
        } catch (twilioErr) {
            console.warn(`[SMS WARNING] Twilio Verify attempt failed (${twilioErr.message}). Checking alternate SMS gateway...`);
        }
    }

    // 2. Fall back to / use configured XSMS gateway
    const apiKey = process.env.SMS_AUTH_KEY || process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER || 'TGSSVM';

    if (!isGatewayConfigured(apiKey)) {
        console.error(`[SMS ERROR] No valid SMS provider credentials configured (neither Twilio nor XSMS).`);
        return { success: false, error: 'SMS service is temporarily unavailable: SMS provider credentials missing or unconfigured.' };
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins
    const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;

    try {
        const url = process.env.SMS_BASE_URL || `https://m.xsms.in/api/sendhttp.php`;
        const params = {
            authkey: apiKey.trim(),
            mobiles: cleanPhone,
            sender: senderId.trim(),
            route: '4',
            country: '91',
            unicode: '1',
            campaign: process.env.SMS_CAMPAIGN || 'test',
            DLT_TE_ID: process.env.DLT_TE_ID || '1507166573508565333',
            message: message
        };

        console.log(`[SMS] Dispatching real-time OTP to ${maskPhone(formattedPhone)} via SMS Gateway...`);
        const response = await axios.get(url, { params, timeout: 8000 });

        const respText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (respText.toLowerCase().includes('error') || respText.toLowerCase().includes('fail') || respText.toLowerCase().includes('invalid')) {
            console.error(`[SMS ERROR] Gateway rejected request:`, respText);
            return { success: false, error: 'Failed to deliver verification code through SMS gateway.' };
        }

        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(formattedPhone, hashedOtp, expiresAt);
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at, attempts) VALUES (?, ?, ?, 0)').run(cleanPhone, hashedOtp, expiresAt);

        // Also sync to attendance_otps for cross-endpoint verification
        try {
            const userRow = db.prepare("SELECT employee_id FROM users WHERE phone = ? OR phone = ?").get(formattedPhone, cleanPhone);
            const activeEmpId = userRow?.employee_id || `EMP-${cleanPhone}`;
            db.prepare('UPDATE attendance_otps SET is_used = 1 WHERE employee_id = ? AND is_used = 0').run(activeEmpId);
            db.prepare('INSERT INTO attendance_otps (employee_id, otp, expires_at, is_used, attempts) VALUES (?, ?, ?, 0, 0)').run(activeEmpId, hashedOtp, expiresAt);
        } catch (syncErr) {
            console.warn('[AUTH OTP SYNC] Could not mirror to attendance_otps:', syncErr.message);
        }

        return { success: true, provider: 'xsms' };
    } catch (error) {
        console.error(`[SMS ERROR] Gateway connection failed:`, error.message);
        return { success: false, error: 'SMS service temporarily unavailable. Please verify network connection or try again shortly.' };
    }
};

/**
 * Checks a verification code securely through Twilio Verify or local database hash.
 * 
 * @param {string} phone - The mobile number
 * @param {string} code - The OTP code to check
 */
const checkVerification = async (phone, code) => {
    if (!phone || !code) {
        return { success: false, error: 'Phone number and verification code are required.' };
    }

    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length > 10) cleanDigits = cleanDigits.slice(-10);
    const formattedPhone = '+91' + cleanDigits;
    const cleanCode = code.trim();

    if (cleanCode.length !== 6) {
        return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    // 1. If Twilio Verify is configured, check Twilio Verify first
    if (isTwilioConfigured()) {
        try {
            const client = getTwilioClient();
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID.trim();
            const verificationCheck = await client.verify.v2.services(serviceSid)
                .verificationChecks
                .create({ to: formattedPhone, code: cleanCode });

            if (verificationCheck.status === 'approved') {
                console.log(`[AUTH] Twilio Verify APPROVED for ${maskPhone(formattedPhone)}`);
                db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(formattedPhone, cleanDigits);
                return { success: true, status: 'approved' };
            }
        } catch (twilioCheckErr) {
            console.warn(`[AUTH] Twilio Verify check attempt returned:`, twilioCheckErr.message);
        }
    }

    // 2. Check local database record (SHA-256 hashed OTP)
    try {
        let row = db.prepare('SELECT otp, expires_at, attempts FROM otps WHERE phone = ? OR phone = ?').get(formattedPhone, cleanDigits);

        const hashedInput = crypto.createHash('sha256').update(cleanCode).digest('hex');

        // If not in otps table, check attendance_otps table
        if (!row) {
            try {
                const userRow = db.prepare("SELECT employee_id FROM users WHERE phone = ? OR phone = ?").get(formattedPhone, cleanDigits);
                if (userRow?.employee_id) {
                    const attRow = db.prepare('SELECT id, otp, expires_at, attempts, is_used FROM attendance_otps WHERE employee_id = ? ORDER BY id DESC LIMIT 1').get(userRow.employee_id);
                    if (attRow && attRow.is_used === 0) {
                        row = attRow;
                    }
                }
            } catch (fallbackErr) {
                // Ignore fallback error
            }
        }

        if (!row) {
            return { success: false, error: 'OTP not found. Please request a new one.' };
        }

        const now = new Date();
        const expiresAt = new Date(row.expires_at);

        if (now > expiresAt) {
            db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(formattedPhone, cleanDigits);
            return { success: false, error: 'OTP expired. Please request a new one.' };
        }

        if (row.otp === hashedInput) {
            console.log(`[AUTH] Verification successful for ${maskPhone(formattedPhone)}`);
            // Single-use guarantee: remove immediately
            db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(formattedPhone, cleanDigits);
            return { success: true, status: 'approved' };
        } else {
            const attempts = (row.attempts || 0) + 1;
            db.prepare('UPDATE otps SET attempts = ? WHERE phone = ? OR phone = ?').run(attempts, formattedPhone, cleanDigits);

            if (attempts >= 5) {
                const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                db.prepare(`
                    INSERT INTO auth_lockouts (identifier, locked_until, reason) 
                    VALUES (?, ?, ?)
                `).run(formattedPhone, lockUntil, 'Exceeded 5 failed login attempts');

                db.prepare('DELETE FROM otps WHERE phone = ? OR phone = ?').run(formattedPhone, cleanDigits);
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
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length > 10) {
        cleanPhone = cleanPhone.slice(-10);
    }
    const formattedPhone = '+91' + cleanPhone;

    // 1. Check Twilio Verify
    if (isTwilioConfigured()) {
        try {
            const client = getTwilioClient();
            const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID.trim();
            const verification = await client.verify.v2.services(serviceSid)
                .verifications
                .create({ to: formattedPhone, channel: 'sms' });
            if (verification.status === 'pending' || verification.status === 'approved') {
                return { success: true, provider: 'twilio' };
            }
        } catch (twErr) {
            console.warn(`[SMS WARNING] Twilio Verify failed for attendance OTP (${twErr.message}). Falling back to gateway...`);
        }
    }

    // 2. Check XSMS gateway
    const apiKey = process.env.SMS_AUTH_KEY || process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER || 'TGSSVM';
    const templateId = process.env.DLT_TE_ID || '1507166573508565333';

    if (!isGatewayConfigured(apiKey)) {
        console.error(`[SMS ERROR] SMS gateway credentials are not configured or invalid.`);
        return { success: false, error: 'SMS service unavailable: Gateway credentials missing' };
    }

    const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;

    try {
        const url = process.env.SMS_BASE_URL || `https://m.xsms.in/api/sendhttp.php`;
        const params = {
            authkey: apiKey.trim(),
            mobiles: cleanPhone,
            sender: senderId.trim(),
            route: '4',
            country: '91',
            unicode: '1',
            campaign: process.env.SMS_CAMPAIGN || 'test',
            DLT_TE_ID: templateId.trim(),
            message: message
        };

        console.log(`[SMS] Sending attendance OTP to ${maskPhone(formattedPhone)} via gateway...`);
        const response = await axios.get(url, { params, timeout: 8000 });

        const respText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (respText.toLowerCase().includes('error') || respText.toLowerCase().includes('fail') || respText.toLowerCase().includes('invalid')) {
            console.error(`[SMS ERROR] Gateway rejected attendance OTP:`, respText);
            return { success: false, error: 'Failed to deliver OTP' };
        }

        return { success: true, provider: 'xsms' };
    } catch (error) {
        console.error(`[SMS ERROR] Gateway connection failed:`, error.message);
        return { success: false, error: 'SMS service temporarily unavailable', details: error.message };
    }
};

module.exports = { sendVerification, checkVerification, sendAttendanceOTP, maskPhone };
