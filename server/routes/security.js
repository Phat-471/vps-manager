const express = require('express');
const router = express.Router();
const SecurityController = require('../controllers/SecurityController');

router.post('/ufw/status', SecurityController.getUFWStatus);
router.post('/ufw/enable', SecurityController.enableUFW);
router.post('/ufw/disable', SecurityController.disableUFW);
router.post('/ufw/add', SecurityController.addUFWRule);
router.post('/ufw/delete', SecurityController.deleteUFWRule);
router.post('/fail2ban/status', SecurityController.getFail2BanStatus);
router.post('/fail2ban/install', SecurityController.installAndEnableFail2Ban);
router.post('/fail2ban/config/save', SecurityController.saveFail2BanConfig);
router.post('/fail2ban/config/raw/get', SecurityController.getRawFail2BanConfig);
router.post('/fail2ban/config/raw/save', SecurityController.saveRawFail2BanConfig);
router.post('/fail2ban/unban', SecurityController.unbanFail2BanIP);
router.post('/fail2ban/ban', SecurityController.banFail2BanIP);
router.post('/fail2ban/control', SecurityController.controlFail2BanService);
router.post('/ssh/port', SecurityController.changeSSHPort);
router.post('/ssh/password-disable', SecurityController.disableSSHPasswordAuth);
router.post('/ports/listening', SecurityController.getListeningPorts);
router.post('/panel/ssl', SecurityController.configurePanelSSL);
router.post('/blacklist/list', SecurityController.getBlacklistIPs);
router.post('/blacklist/block', SecurityController.blockIP);
router.post('/blacklist/unblock', SecurityController.unblockIP);

// Security zones routes
router.post('/zones/list', SecurityController.listZones);
router.post('/zones/save', SecurityController.saveZone);
router.post('/zones/delete', SecurityController.deleteZone);
router.post('/zones/apply', SecurityController.applyZones);

module.exports = router;
