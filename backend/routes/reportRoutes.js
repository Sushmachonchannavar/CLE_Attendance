const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.get('/staff-count', auth, role(['admin', 'hoi', 'principal']), reportController.getStaffCount);
router.get('/staff', auth, role(['admin', 'hoi', 'principal']), reportController.getStaffList);
router.get('/daily', auth, role(['admin', 'hoi', 'principal']), reportController.getDailyReport);
router.get('/monthly', auth, role(['admin', 'hoi', 'principal']), reportController.getMonthlyReport);
router.get('/monthly/download', auth, role(['admin', 'hoi', 'principal']), reportController.downloadMonthlyReport);

module.exports = router;
