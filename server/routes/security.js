const express = require('express');
const router = express.Router();
const SecurityController = require('../controllers/SecurityController');

router.post('/ufw/status', SecurityController.getUFWStatus);
router.post('/ufw/enable', SecurityController.enableUFW);
router.post('/ufw/disable', SecurityController.disableUFW);
router.post('/ufw/add', SecurityController.addUFWRule);
router.post('/ufw/delete', SecurityController.deleteUFWRule);
router.post('/fail2ban/status', SecurityController.getFail2BanStatus);
router.post('/ssh/port', SecurityController.changeSSHPort);
router.post('/ports/listening', SecurityController.getListeningPorts);
router.post('/panel/ssl', SecurityController.configurePanelSSL);
router.post('/blacklist/list', SecurityController.getBlacklistIPs);
router.post('/blacklist/block', SecurityController.blockIP);
router.post('/blacklist/unblock', SecurityController.unblockIP);

module.exports = router;
