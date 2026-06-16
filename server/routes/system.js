const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/SystemController');

// System info routes
router.post('/info', SystemController.getSystemInfo);
router.post('/cpu', SystemController.getCPUInfo);
router.post('/memory', SystemController.getMemoryInfo);
router.post('/disk', SystemController.getDiskInfo);
router.post('/network', SystemController.getNetworkInfo); // Keeping this route as it was not explicitly removed

// Process management
router.post('/processes', SystemController.getProcesses);
router.post('/kill-process', SystemController.killProcess); // Changed from '/processes/kill'

// Reset and update routes
router.post('/clean-packages', SystemController.cleanPackages);
router.post('/reset-applications', SystemController.resetApplications);
router.post('/full-update', SystemController.fullSystemUpdate);
router.post('/update-panel', SystemController.updatePanel);
router.post('/setup-panel-ssl', SystemController.configurePanelSSL);

// New quick action routes
router.post('/reboot', SystemController.rebootVPS);
router.post('/clean-cache', SystemController.cleanSystemCache);
router.post('/clean-logs', SystemController.cleanSystemLogs);
router.post('/change-password', SystemController.changeRootPassword);
router.post('/setup-check', SystemController.getSetupChecklist);

// Service Health Monitor + Quick Restart (Phase 6)
router.post('/service-health', SystemController.getServiceHealth);
router.post('/service-restart', SystemController.quickRestartService);

module.exports = router;
