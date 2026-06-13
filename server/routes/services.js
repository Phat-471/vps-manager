const express = require('express');
const router = express.Router();
const ServiceController = require('../controllers/ServiceController');

// Service management
router.post('/list', ServiceController.listServices);
router.post('/status', ServiceController.getServiceStatus);
router.post('/start', ServiceController.startService);
router.post('/stop', ServiceController.stopService);
router.post('/restart', ServiceController.restartService);
router.post('/enable', ServiceController.enableService);
router.post('/disable', ServiceController.disableService);
router.post('/logs', ServiceController.getServiceLogs);

module.exports = router;
