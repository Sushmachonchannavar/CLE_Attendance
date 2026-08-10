const axios = require('axios');
const db = require('../database');

/**
 * Generates a random 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Starts a phone verification using XSMS API and local storage.
 * 
 * @param {string} phone - The mobile number
 */
const sendVerification = async (phone) => {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER || 'TGSSVM';
    
    // Normalize phone (use last 10 digits since country code 91 is specified)
    let cleanPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    if (cleanPhone.length > 10) {
        cleanPhone = cleanPhone.slice(-10);
    }
    
    // Normalized format for local DB storage (with +91)
    let formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;

    // Mock mode or Demo Numbers
    const demoNumbers = ['+911234567890', '+919876543210', '+919999999999', '+918888888888'];
    if (demoNumbers.includes(formattedPhone) || !apiKey || apiKey.includes('_HERE') || apiKey === 'your_sms_api_key') {
        console.log(`\x1b[33m%s\x1b[0m`, `[MOCK VERIFY] Starting verification for ${formattedPhone} (Demo/Mock Mode activated)`);
        
        // Even in mock mode, we store the OTP so checkVerification works
        const mockOtp = '123456';
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)').run(formattedPhone, mockOtp, expiresAt);
        
        return { success: true, mock: true };
    }

    const otp = generateOTP();
    // Exact DLT registered message template
    const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;
    
    try {
        const url = `https://m.xsms.in/api/sendhttp.php`;
        const params = {
            authkey: apiKey,
            mobiles: cleanPhone,
            sender: senderId,
            route: '4',
            country: '91',
            unicode: '1',
            campaign: 'test',
            DLT_TE_ID: process.env.DLT_TE_ID || '1507166573508565333',
            message: message
        };

        console.log(`[SMS] Sending Verification OTP to ${cleanPhone}...`);
        const response = await axios.get(url, { params });
        console.log(`[SMS] API Response:`, response.data);

        const respText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (respText.toLowerCase().includes('error') || respText.toLowerCase().includes('fail') || respText.toLowerCase().includes('invalid')) {
            console.error(`[ERROR] XSMS API returned error:`, respText);
            return { success: false, error: respText };
        }

        // Store OTP in database
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)').run(formattedPhone, otp, expiresAt);
        return { success: true, status: 'pending' };
    } catch (error) {
        console.error(`[ERROR] XSMS API Failed:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Checks a verification code using local database.
 * 
 * @param {string} phone - The mobile number
 * @param {string} code - The OTP code to check
 */
const checkVerification = async (phone, code) => {
    let formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;

    try {
        const row = db.prepare('SELECT otp, expires_at FROM otps WHERE phone = ?').get(formattedPhone);

        if (!row) {
            console.warn(`[FAILED] No OTP found for ${formattedPhone}`);
            return { success: false, error: 'OTP not found' };
        }

        const now = new Date();
        const expiresAt = new Date(row.expires_at);

        if (now > expiresAt) {
            console.warn(`[FAILED] OTP expired for ${formattedPhone}`);
            db.prepare('DELETE FROM otps WHERE phone = ?').run(formattedPhone);
            return { success: false, error: 'OTP expired' };
        }

        if (row.otp === code) {
            console.log(`[SUCCESS] Verification APPROVED for ${formattedPhone}`);
            // Delete OTP after successful verification
            db.prepare('DELETE FROM otps WHERE phone = ?').run(formattedPhone);
            return { success: true, status: 'approved' };
        } else {
            console.warn(`[FAILED] Invalid OTP for ${formattedPhone}. Expected ${row.otp}, got ${code}`);
            return { success: false, error: 'Invalid OTP' };
        }
    } catch (error) {
        console.error(`[ERROR] Local OTP Check Failed:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Sends a secure attendance OTP using m.xsms.in sendhttp.php API
 * 
 * @param {string} phone - Mobile number
 * @param {string} otp - 6-digit OTP
 */
const sendAttendanceOTP = async (phone, otp) => {
    const apiKey = process.env.SMS_API_KEY || '508941AwTrDuc95m6a5f3f66P1';
    const senderId = process.env.SMS_SENDER || 'TGSSVM';
    const templateId = process.env.DLT_TE_ID || '1507166573508565333';

    // Normalize phone (use last 10 digits since country code 91 is specified)
    let cleanPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    if (cleanPhone.length > 10) {
        cleanPhone = cleanPhone.slice(-10);
    }

    // Normalized format for logging (with +91)
    let formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;

    // Mock mode or Demo Numbers
    const demoNumbers = ['+911234567890', '+919876543210', '+919999999999', '+918888888888'];
    if (demoNumbers.includes(formattedPhone) || !apiKey || apiKey.includes('_HERE') || apiKey === 'your_sms_api_key') {
        console.log(`\x1b[33m%s\x1b[0m`, `[MOCK SMS] Sent OTP ${otp} to ${formattedPhone} (Demo/Mock Mode)`);
        return { success: true, mock: true };
    }

    // Exact DLT registered message template
    const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;

    try {
        const url = `https://m.xsms.in/api/sendhttp.php`;
        const params = {
            authkey: apiKey,
            mobiles: cleanPhone,
            sender: senderId,
            route: '4',
            country: '91',
            unicode: '1',
            campaign: 'test',
            DLT_TE_ID: templateId,
            message: message
        };

        console.log(`[SMS] Sending OTP to ${cleanPhone} via m.xsms.in...`);
        const response = await axios.get(url, { params });
        console.log(`[SMS] XSMS API Response:`, response.data);

        const respText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (respText.toLowerCase().includes('error') || respText.toLowerCase().includes('fail') || respText.toLowerCase().includes('invalid')) {
            console.error(`[ERROR] XSMS API returned error response:`, respText);
            return { success: false, error: respText };
        }

        return { success: true, response: respText };
    } catch (error) {
        console.error(`[ERROR] XSMS API Call Failed:`, error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendVerification, checkVerification, sendAttendanceOTP };

