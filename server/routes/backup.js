const express = require('express');
const router = express.Router();
const BackupController = require('../controllers/BackupController');

router.post('/list', BackupController.listBackups);
router.post('/create', BackupController.createBackup);
router.post('/restore', BackupController.restoreBackup);
router.post('/delete', BackupController.deleteBackup);
router.post('/download', BackupController.downloadBackup);
router.post('/rclone/install', BackupController.installRclone);
router.post('/rclone/status', BackupController.checkRcloneStatus);
router.post('/rclone/remotes', BackupController.listRcloneRemotes);
router.post('/rclone/remotes/save', BackupController.saveRcloneRemote);
router.post('/rclone/remotes/delete', BackupController.deleteRcloneRemote);
router.post('/rclone/remotes/test', BackupController.testRcloneRemote);
router.post('/rclone/sync-file', BackupController.syncFileToCloud);

module.exports = router;
