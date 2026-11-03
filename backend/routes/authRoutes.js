const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter, registerLimiter } = require('../middleware/rateLimiter');

router.post('/login', otpSendLimiter, authController.login);
router.post('/send-otp', otpSendLimiter, authController.login);
router.post('/register', registerLimiter, authController.register);
router.post('/verify', otpVerifyLimiter, authController.verify);
router.post('/verify-otp', otpVerifyLimiter, authController.verify);
router.get('/verify-token', authMiddleware, authController.verifyToken);
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;
