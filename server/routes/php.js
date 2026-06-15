const express = require('express');
const router = express.Router();
const PHPController = require('../controllers/PHPController');

router.post('/config/get', PHPController.getPHPConfig);
router.post('/config/save', PHPController.savePHPConfig);
router.post('/config/raw/get', PHPController.getRawPHPConfig);
router.post('/config/raw/save', PHPController.saveRawPHPConfig);
router.post('/extensions/list', PHPController.getPHPExtensions);
router.post('/extensions/install', PHPController.installPHPExtension);
router.post('/versions/list', PHPController.listPHPVersions);
router.post('/versions/install', PHPController.installPHPVersion);
router.post('/versions/set-default', PHPController.setDefaultPHPVersion);

module.exports = router;
