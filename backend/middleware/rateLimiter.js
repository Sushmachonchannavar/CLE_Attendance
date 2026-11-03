const { rateLimit } = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

// Rate limiter for OTP dispatch endpoints (send-otp / login)
const otpSendLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: isTest ? 1000 : 10,  // Max 10 OTP requests per 10 mins per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many OTP requests from this IP address. Please try again after 10 minutes.'
    }
});

// Rate limiter for OTP verification endpoints (verify-otp / verify)
const otpVerifyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: isTest ? 1000 : 20,  // Max 20 verification attempts per 10 mins per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many verification attempts from this IP address. Please try again after 10 minutes.'
    }
});

// Rate limiter for user registration (register)
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isTest ? 1000 : 10,  // Max 10 registration attempts per 15 mins per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many registration requests from this IP address. Please try again after 15 minutes.'
    }
});

module.exports = {
    otpSendLimiter,
    otpVerifyLimiter,
    registerLimiter
};

