const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const auth = require('../middleware/authMiddleware');

router.post('/send-otp', attendanceController.sendOTP);
router.post('/verify-otp', attendanceController.verifyOTP);
router.post('/punch', auth, attendanceController.punch);
router.get('/history', auth, attendanceController.getHistory);
router.get('/status', auth, attendanceController.getStatus);

module.exports = router;