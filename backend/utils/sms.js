const twilio = require('twilio');

/**
 * Starts a phone verification using Twilio Verify V2 API.
 * 
 * @param {string} phone - The mobile number (must include country code, e.g., +91)
 */
const sendVerification = async (phone) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    // Ensure phone has country code
    let formattedPhone = phone;
    if (!phone.startsWith('+')) {
        formattedPhone = '+91' + phone;
    }

    // Mock mode
    if (!accountSid || accountSid.includes('_HERE') || !authToken || authToken.includes('_HERE')) {
        console.log(`\x1b[33m%s\x1b[0m`, `[MOCK VERIFY] Starting verification for ${formattedPhone}`);
        return { success: true, mock: true };
    }

    const client = twilio(accountSid, authToken);

    try {
        const verification = await client.verify.v2.services(serviceSid)
            .verifications
            .create({ to: formattedPhone, channel: 'sms' });

        console.log(`[SUCCESS] Twilio Verification Started for ${formattedPhone}. Status: ${verification.status}`);
        return { success: true, status: verification.status };
    } catch (error) {
        console.error(`[ERROR] Twilio Verify Start Failed:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Checks a verification code using Twilio Verify V2 API.
 * 
 * @param {string} phone - The mobile number
 * @param {string} code - The OTP code to check
 */
const checkVerification = async (phone, code) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    // Ensure phone has country code
    let formattedPhone = phone;
    if (!phone.startsWith('+')) {
        formattedPhone = '+91' + phone;
    }

    // Mock mode: Any 6-digit code works for demo if no credentials
    if (!accountSid || accountSid.includes('_HERE') || !authToken || authToken.includes('_HERE')) {
        console.log(`[MOCK CHECK] Checking code ${code} for ${formattedPhone}`);
        if (code === '123456') return { success: true, status: 'approved' };
        return { success: false, error: 'Invalid mock OTP' };
    }

    const client = twilio(accountSid, authToken);

    try {
        const verificationCheck = await client.verify.v2.services(serviceSid)
            .verificationChecks
            .create({ to: formattedPhone, code: code });

        if (verificationCheck.status === 'approved') {
            console.log(`[SUCCESS] Verification APPROVED for ${formattedPhone}`);
            return { success: true, status: 'approved' };
        } else {
            console.warn(`[FAILED] Verification status: ${verificationCheck.status}`);
            return { success: false, error: `Verification ${verificationCheck.status}` };
        }
    } catch (error) {
        console.error(`[ERROR] Twilio Verify Check Failed:`, error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendVerification, checkVerification };
