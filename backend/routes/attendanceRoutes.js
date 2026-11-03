const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const auth = require('../middleware/authMiddleware');
const { otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

router.post('/send-otp', otpSendLimiter, attendanceController.sendOTP);
router.post('/login', otpSendLimiter, attendanceController.sendOTP);
router.post('/verify-otp', otpVerifyLimiter, attendanceController.verifyOTP);
router.post('/verify', otpVerifyLimiter, attendanceController.verifyOTP);
router.post('/punch', auth, attendanceController.punch);
router.get('/history', auth, attendanceController.getHistory);
router.get('/status', auth, attendanceController.getStatus);

module.exports = router;
