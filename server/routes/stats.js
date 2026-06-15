const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/StatsController');

router.post('/list-logs', StatsController.listLogFiles);
router.post('/summary', StatsController.getTrafficStats);
router.post('/history', StatsController.getHistoricalStats);

module.exports = router;
