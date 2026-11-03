const express = require('express');
const router = express.Router();

// The public /api/sms/send-otp endpoint has been removed for security.
// All OTP generation and dispatch now strictly routes through /api/attendance/send-otp and /api/auth/login.

module.exports = router;
