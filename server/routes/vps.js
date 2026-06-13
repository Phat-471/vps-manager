const express = require('express');
const router = express.Router();
const VPSController = require('../controllers/VPSController');

// Test VPS connection
router.post('/test-connection', VPSController.testConnection);

module.exports = router;
