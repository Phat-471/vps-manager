const express = require('express');
const router = express.Router();
const NodeController = require('../controllers/NodeController');

router.post('/status', NodeController.getNodeStatus);
router.post('/install-nvm', NodeController.installNVM);
router.post('/versions/list', NodeController.listNodeVersions);
router.post('/versions/install', NodeController.installNodeVersion);
router.post('/versions/set-default', NodeController.setDefaultNodeVersion);
router.post('/versions/uninstall', NodeController.uninstallNodeVersion);
router.post('/pm2/startup', NodeController.setupPM2Startup);

module.exports = router;
