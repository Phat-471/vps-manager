const express = require('express');
const router = express.Router();
const CentralMonitorController = require('../controllers/CentralMonitorController');

// Lấy cấu hình URL/Token giám sát trung tâm
router.get('/config', CentralMonitorController.getConfig);

// Lưu cấu hình URL/Token giám sát trung tâm
router.post('/config', CentralMonitorController.saveConfig);

// Lấy danh sách VPS cài đặt
router.get('/list', CentralMonitorController.getList);

// Lấy stats lịch sử của một VPS
router.get('/stats', CentralMonitorController.getStats);

// Xóa bản ghi cài đặt VPS
router.post('/delete', CentralMonitorController.deleteRecord);

// Gửi báo cáo lỗi về máy chủ trung tâm
router.post('/report-bug', CentralMonitorController.reportBug);

module.exports = router;
