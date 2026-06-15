const express = require('express');
const router = express.Router();
const LogController = require('../controllers/LogController');

// Đăng ký các route nhật ký
router.post('/list', LogController.listLogs);
router.post('/clear', LogController.clearLogs);

module.exports = router;
