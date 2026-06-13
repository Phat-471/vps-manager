const express = require('express');
const router = express.Router();
const AlertController = require('../controllers/AlertController');

router.post('/config/get', AlertController.getConfig);
router.post('/config/save-channels', AlertController.saveChannels);
router.post('/config/save-threshold', AlertController.saveThreshold);
router.post('/test/telegram', AlertController.testTelegram);
router.post('/test/discord', AlertController.testDiscord);

module.exports = router;
