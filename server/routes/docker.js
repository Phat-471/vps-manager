const express = require('express');
const router = express.Router();
const DockerController = require('../controllers/DockerController');

router.post('/list', DockerController.listContainers);
router.post('/start', DockerController.startContainer);
router.post('/stop', DockerController.stopContainer);
router.post('/restart', DockerController.restartContainer);
router.post('/remove', DockerController.removeContainer);
router.post('/logs', DockerController.getLogs);
router.post('/prune', DockerController.pruneDocker);

module.exports = router;
