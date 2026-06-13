const express = require('express');
const router = express.Router();
const FileController = require('../controllers/FileController');

// File operations
router.post('/list', FileController.listFiles);
router.post('/read', FileController.readFile);
router.post('/write', FileController.writeFile);
router.post('/delete', FileController.deleteFile);
router.post('/rename', FileController.renameFile);
router.post('/chmod', FileController.chmod);
router.post('/copy', FileController.copyFile);

// Folder operations
router.post('/mkdir', FileController.createFolder);

// Upload/Download
router.post('/upload', ...FileController.uploadFile);
router.post('/download', FileController.downloadFile);

module.exports = router;
