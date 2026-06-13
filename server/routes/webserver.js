const express = require('express');
const router = express.Router();
const WebServerController = require('../controllers/WebServerController');

router.post('/list', WebServerController.listSites);
router.post('/add', WebServerController.addSite);
router.post('/delete', WebServerController.deleteSite);
router.post('/config', WebServerController.getSiteConfig);
router.post('/save-config', WebServerController.saveSiteConfig);
router.post('/toggle', WebServerController.toggleSite);
router.post('/ssl', WebServerController.installSSL);
router.post('/status', WebServerController.getNginxStatus);

// Domain & DNS config routes
router.post('/check-dns', WebServerController.checkDNS);
router.post('/get-hosts', WebServerController.getHosts);
router.post('/save-hosts', WebServerController.saveHosts);

// SSL routes
router.post('/ssl/list', WebServerController.listSSLCertificates);
router.post('/ssl/renew-all', WebServerController.renewAllSSL);
router.post('/ssl/setup-cron', WebServerController.setupSSLAutoRenewCron);

module.exports = router;
