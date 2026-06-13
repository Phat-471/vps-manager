const express = require('express');
const router = express.Router();
const PHPController = require('../controllers/PHPController');

router.post('/config/get', PHPController.getPHPConfig);
router.post('/config/save', PHPController.savePHPConfig);
router.post('/extensions/list', PHPController.getPHPExtensions);
router.post('/extensions/install', PHPController.installPHPExtension);

module.exports = router;
