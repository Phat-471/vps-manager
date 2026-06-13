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
router.post('/installed', SoftwareController.getInstalledSoftware);

module.exports = router;
