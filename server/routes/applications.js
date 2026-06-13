const express = require('express');
const router = express.Router();
const ApplicationController = require('../controllers/ApplicationController');

// Application Management Routes
router.post('/list', ApplicationController.listApplications);
router.post('/start', ApplicationController.startApplication);
router.post('/stop', ApplicationController.stopApplication);
router.post('/restart', ApplicationController.restartApplication);
router.post('/delete', ApplicationController.deleteApplication);
router.post('/logs', ApplicationController.getApplicationLogs);
router.post('/create-wizard', ApplicationController.createAppWizard);
router.post('/list-used-ports', ApplicationController.listUsedPorts);
router.post('/check-port', ApplicationController.checkPortAvailability);
router.post('/get-env', ApplicationController.getEnvVariables);
router.post('/save-env', ApplicationController.saveEnvVariables);

module.exports = router;
