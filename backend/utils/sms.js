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
    const senderId = process.env.SMS_SENDER || 'CLE SOC';
    
    // Normalize phone for XSMS API (needs 91 prefix but no +)
    let cleanPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }
    
    // Normalized format for local DB storage (with +91)
    let formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;

    // Mock mode or Demo Numbers
    const demoNumbers = ['+911234567890', '+919876543210', '+919999999999', '+918888888888'];
    if (demoNumbers.includes(formattedPhone) || !apiKey || apiKey.includes('_HERE')) {
        console.log(`\x1b[33m%s\x1b[0m`, `[MOCK VERIFY] Starting verification for ${formattedPhone} (Demo/Mock Mode activated)`);
        
        // Even in mock mode, we store the OTP so checkVerification works
        const mockOtp = '123456';
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
        db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)').run(formattedPhone, mockOtp, expiresAt);
        
        return { success: true, mock: true };
    }

    const otp = generateOTP();
    const message = `Your OTP for CLE Attendance is ${otp}. Please do not share it with anyone.`;
    
    try {
        const url = `http://m.xsms.in/api/otp.php`;
        const params = {
            authkey: apiKey,
            mobile: cleanPhone,
            message: message,
            sender: senderId,
            otp: otp,
            otp_length: 6
        };

        console.log(`[SMS] Sending OTP to ${cleanPhone}...`);
        const response = await axios.get(url, { params });
        
        // Check response (XSMS returns { message: '...', type: 'success/error' })
        console.log(`[SMS] API Response:`, response.data);

        if (response.data && response.data.type === 'success') {
            // Store OTP in database
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
            db.prepare('INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)').run(formattedPhone, otp, expiresAt);
            return { success: true, status: 'pending' };
        } else {
            const errorMsg = response.data?.message || 'API rejected the request';
            console.error(`[ERROR] XSMS API returned error:`, errorMsg);
            return { success: false, error: errorMsg };
        }
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

module.exports = { sendVerification, checkVerification };
