const express = require('express');
const router = express.Router();
const BackupController = require('../controllers/BackupController');

router.post('/list', BackupController.listBackups);
router.post('/create', BackupController.createBackup);
router.post('/restore', BackupController.restoreBackup);
router.post('/delete', BackupController.deleteBackup);
router.post('/download', BackupController.downloadBackup);

module.exports = router;
