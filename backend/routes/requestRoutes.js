const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Leaves
router.post('/leaves', auth, requestController.applyLeave);
router.get('/leaves', auth, requestController.getLeaves); // My leaves
router.get('/leaves/all', auth, role(['admin', 'hoi', 'principal']), requestController.getAllLeaves); // All leaves (Admin/HOI/Principal)
router.put('/leaves/:id', auth, role(['admin', 'hoi', 'principal']), requestController.updateLeaveStatus);
router.delete('/leaves/:id', auth, requestController.deleteLeave);

// ODs
router.post('/od', auth, upload, requestController.applyOD);
router.get('/od', auth, requestController.getODs); // My ODs
router.get('/od/all', auth, role(['admin', 'hoi', 'principal']), requestController.getAllODs); // All ODs (Admin/HOI/Principal)
router.put('/od/:id', auth, role(['admin', 'hoi', 'principal']), requestController.updateODStatus);
router.delete('/od/:id', auth, requestController.deleteOD);
router.get('/od/view/:id', auth, requestController.viewODDocument);
router.get('/od/download/:id', auth, requestController.downloadODDocument);

module.exports = router;
