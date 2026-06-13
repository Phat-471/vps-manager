const express = require('express');
const router = express.Router();
const CronController = require('../controllers/CronController');

router.post('/list', CronController.listJobs);
router.post('/add', CronController.addJob);
router.post('/edit', CronController.editJob);
router.post('/toggle', CronController.toggleJob);
router.post('/delete', CronController.deleteJob);
router.post('/run', CronController.runJobManually);

module.exports = router;
