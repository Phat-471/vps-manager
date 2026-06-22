const express = require('express');
const router = express.Router();
const WebServerController = require('../controllers/WebServerController');

router.post('/list', WebServerController.listSites);
router.post('/add', WebServerController.addSite);
router.post('/delete', WebServerController.deleteSite);
router.post('/config', WebServerController.getSiteConfig);
router.post('/save-config', WebServerController.saveSiteConfig);
router.post('/toggle', WebServerController.toggleSite);
router.post('/update-security', WebServerController.updateSiteSecurity);
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
router.post('/ssl/check-cron', WebServerController.checkSSLAutoRenewStatus);
router.post('/ssl/test-dryrun', WebServerController.testSSLAutoRenew);
router.post('/ssl/wildcard', WebServerController.installWildcardSSL);
router.post('/ssl/custom', WebServerController.uploadCustomSSL);

// Nginx Config Scanner & Auto-Fix (Phase 4)
router.post('/nginx/scan', WebServerController.scanNginxConfig);
router.post('/nginx/fix', WebServerController.fixNginxIssue);

module.exports = router;
