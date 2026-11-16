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
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.get('/sessions', authMiddleware, authController.getSessions);
router.delete('/sessions/:id', authMiddleware, authController.revokeSession);
router.delete('/sessions', authMiddleware, authController.revokeOtherSessions);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/profile', authMiddleware, authController.updateProfile);

module.exports = router;
