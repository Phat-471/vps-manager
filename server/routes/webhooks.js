const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/WebhookController');

// Webhook CRUD Routes
router.post('/list', WebhookController.listWebhooks);
router.post('/create', WebhookController.createWebhook);
router.post('/update', WebhookController.updateWebhook);
router.post('/delete', WebhookController.deleteWebhook);
router.post('/trigger-manual', WebhookController.triggerManual);

module.exports = router;
