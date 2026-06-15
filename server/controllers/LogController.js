const fs = require('fs');
const path = require('path');

const LOGS_FILE = path.join(__dirname, '../data/activity_logs.json');

/**
 * API: Lấy danh sách nhật ký hoạt động
 */
async function listLogs(req, res) {
    try {
        const { vpsId } = req.body; // Lấy vpsId từ request body
        
        let logs = [];
        if (fs.existsSync(LOGS_FILE)) {
            const data = fs.readFileSync(LOGS_FILE, 'utf8');
            try {
                logs = JSON.parse(data || '[]');
            } catch (e) {
                logs = [];
            }
        }

        // Lọc theo VPS ID nếu được cung cấp
        if (vpsId) {
            logs = logs.filter(log => log.vpsId === vpsId || log.vpsId === null);
        }

        res.json({
            success: true,
            data: logs
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Xóa toàn bộ nhật ký hoạt động
 */
async function clearLogs(req, res) {
    try {
        if (fs.existsSync(LOGS_FILE)) {
            fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf8');
        }
        res.json({
            success: true,
            message: 'Đã xóa toàn bộ nhật ký hoạt động thành công'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listLogs,
    clearLogs
};
