const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.post('/send-otp', auth, role(['admin']), async (req, res, next) => {
    try {
        const { mobile, otp } = req.body;

        // Validation
        if (!mobile || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile number and OTP are required"
            });
        }

        // Normalize phone (use last 10 digits since country code 91 is specified)
        let cleanMobile = mobile.replace(/\D/g, '');
        if (cleanMobile.length > 10) {
            cleanMobile = cleanMobile.slice(-10);
        }

        // SMS DLT-approved message template (exact spaces, punctuation, capitalization, line breaks)
        const message = `जरूरी सूचना  Dear Staff your OTP for attendance punch-in is ${otp} This code is valid for 5 minutes Please do not share it C.L.E Society's Sr Sec School`;

        // Build query parameters using URLSearchParams
        const queryParams = new URLSearchParams({
            authkey: process.env.SMS_AUTH_KEY,
            mobiles: cleanMobile,
            sender: process.env.SMS_SENDER,
            route: '4',
            country: '91',
            unicode: '1',
            campaign: 'attendance',
            DLT_TE_ID: process.env.DLT_TE_ID,
            message: message
        });

        const baseUrl = process.env.SMS_BASE_URL || 'https://m.xsms.in/api/sendhttp.php';
        const url = `${baseUrl}?${queryParams.toString()}`;
        const response = await axios.get(url);

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            gatewayResponse: response.data
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
