const express = require('express');
const router = express.Router();
const MailController = require('../controllers/MailController');

router.post('/status', MailController.getMailStatus);
router.post('/install', MailController.installMailServer);
router.post('/dns-instructions', MailController.getDNSInstructions);
router.post('/mailbox/list', MailController.listMailboxes);
router.post('/mailbox/create', MailController.createMailbox);
router.post('/mailbox/delete', MailController.deleteMailbox);

// SMTP Relay routes
router.post('/relay/get', MailController.getSMTPRelayConfig);
router.post('/relay/save', MailController.saveSMTPRelayConfig);

module.exports = router;
