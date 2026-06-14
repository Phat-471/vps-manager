const express = require('express');
const router = express.Router();
const AppInstallerController = require('../controllers/AppInstallerController');

router.post('/wordpress', AppInstallerController.installWordPress);
router.post('/laravel', AppInstallerController.installLaravel);

module.exports = router;
