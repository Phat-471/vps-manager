const fs = require('fs');
const path = require('path');

const LOGS_FILE = path.join(__dirname, '../data/activity_logs.json');

/**
 * Ghi log hoạt động của panel vào file JSON cục bộ
 * @param {string} action - Hành động thực hiện (ví dụ: 'Create Website', 'Login')
 * @param {string} details - Chi tiết hành động (ví dụ: 'Đã tạo website test.com')
 * @param {string} vpsId - ID của VPS thực hiện hành động (nếu có)
 * @param {string} username - Người thực hiện (mặc định: 'admin')
 */
function logActivity(action, details, vpsId = null, username = 'admin') {
    try {
        let logs = [];
        const dir = path.dirname(LOGS_FILE);
        
        // Đảm bảo thư mục tồn tại
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(LOGS_FILE)) {
            const data = fs.readFileSync(LOGS_FILE, 'utf8');
            try {
                logs = JSON.parse(data || '[]');
            } catch (e) {
                logs = [];
            }
        }

        const newLog = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            action,
            details,
            vpsId,
            username
        };

        logs.unshift(newLog);

        // Giới hạn 1000 logs mới nhất
        if (logs.length > 1000) {
            logs = logs.slice(0, 1000);
        }

        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
    } catch (err) {
        console.error('Lỗi ghi nhật ký hoạt động panel:', err);
    }
}

module.exports = {
    logActivity
};
