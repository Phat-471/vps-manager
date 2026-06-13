const express = require('express');
const router = express.Router();
const MailController = require('../controllers/MailController');

router.post('/status', MailController.getMailStatus);
router.post('/install', MailController.installMailServer);
router.post('/dns-instructions', MailController.getDNSInstructions);
router.post('/mailbox/list', MailController.listMailboxes);
router.post('/mailbox/create', MailController.createMailbox);
router.post('/mailbox/delete', MailController.deleteMailbox);

module.exports = router;
