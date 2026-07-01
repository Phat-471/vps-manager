const express = require('express');
const router = express.Router();
const SoftwareController = require('../controllers/SoftwareController');

// Software installation
router.post('/detect-os', SoftwareController.detectOS);
router.post('/install', SoftwareController.installPackage);
router.post('/update', SoftwareController.updateSystem);

// One-click installers
router.post('/install-lemp', SoftwareController.installLEMP);
router.post('/install-nodejs', SoftwareController.installNodeJS);
router.post('/install-docker', SoftwareController.installDocker);
router.post('/install-python', SoftwareController.installPython);
router.post('/install-redis', SoftwareController.installRedis);
router.post('/install-mongodb', SoftwareController.installMongoDB);
router.post('/install-postgresql', SoftwareController.installPostgreSQL);
router.post('/install-pm2', SoftwareController.installPM2);
router.post('/install-git', SoftwareController.installGit);
router.post('/install-certbot', SoftwareController.installCertbot);
router.post('/install-composer', SoftwareController.installComposer);
router.post('/install-nginx', SoftwareController.installNginx);
router.post('/install-mysql', SoftwareController.installMySQL);
router.post('/install-php', SoftwareController.installPHP);
router.post('/install-java', SoftwareController.installJava);
router.post('/install-apache', SoftwareController.installApache);
router.post('/install-fail2ban', SoftwareController.installFail2Ban);
router.post('/install-golang', SoftwareController.installGolang);
router.post('/install-rsync', SoftwareController.installRsync);
router.post('/install-ufw', SoftwareController.installUFW);
router.post('/install-supervisor', SoftwareController.installSupervisor);
router.post('/install-rclone', SoftwareController.installRclone);
router.post('/install-netdata', SoftwareController.installNetdata);
router.post('/install-vsftpd', SoftwareController.installVsftpd);
router.post('/install-phpmyadmin', SoftwareController.installPhpMyAdmin);
router.post('/install-portainer', SoftwareController.installPortainer);
router.post('/install-memcached', SoftwareController.installMemcached);
router.post('/install-postfix', SoftwareController.installPostfix);
router.post('/installed', SoftwareController.getInstalledSoftware);
router.post('/uninstall', SoftwareController.uninstallSoftware);

module.exports = router;
