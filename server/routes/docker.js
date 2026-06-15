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
router.post('/deploy', DockerController.deployContainer);
router.post('/images', DockerController.listImages);
router.post('/pull', DockerController.pullImage);
router.post('/remove-image', DockerController.removeImage);

// Docker Compose Stacks
router.post('/compose/list', DockerController.listComposeProjects);
router.post('/compose/config', DockerController.getComposeConfig);
router.post('/compose/save', DockerController.saveComposeConfig);
router.post('/compose/prepare-cmd', DockerController.prepareComposeCmd);
router.post('/compose/delete', DockerController.deleteComposeProject);

module.exports = router;
