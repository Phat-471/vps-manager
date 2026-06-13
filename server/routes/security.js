const express = require('express');
const router = express.Router();
const SecurityController = require('../controllers/SecurityController');

router.post('/ufw/status', SecurityController.getUFWStatus);
router.post('/ufw/enable', SecurityController.enableUFW);
router.post('/ufw/disable', SecurityController.disableUFW);
router.post('/ufw/add', SecurityController.addUFWRule);
router.post('/ufw/delete', SecurityController.deleteUFWRule);
router.post('/fail2ban/status', SecurityController.getFail2BanStatus);

module.exports = router;
