const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

router.post('/status', AuthController.checkStatus);
router.post('/login', AuthController.login);
router.post('/setup', AuthController.setup);
router.post('/encryption-key', AuthController.getEncryptionKey);

module.exports = router;
