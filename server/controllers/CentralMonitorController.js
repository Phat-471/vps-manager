const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/central_config.json');

// Đọc cấu hình từ file
function readConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Lỗi đọc cấu hình central monitor:', err);
    }
    return { url: '', token: '' };
}

// Ghi cấu hình vào file
function writeConfig(config) {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Lỗi ghi cấu hình central monitor:', err);
        return false;
    }
}

/**
 * Lấy cấu hình hiển thị (ẩn token thực tế)
 */
async function getConfig(req, res) {
    const config = readConfig();
    res.json({
        success: true,
        url: config.url || '',
        hasToken: !!config.token
    });
}

/**
 * Lưu cấu hình mới
 */
async function saveConfig(req, res) {
    try {
        const { url, token } = req.body;
        
        if (!url) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số URL máy chủ trung tâm' });
        }

        // Loại bỏ gạch chéo cuối URL nếu có
        const cleanUrl = url.trim().replace(/\/+$/, '');

        const currentConfig = readConfig();
        const newConfig = {
            url: cleanUrl,
            token: token !== undefined ? token.trim() : currentConfig.token
        };

        if (writeConfig(newConfig)) {
            res.json({ success: true, message: 'Đã lưu cấu hình thành công!' });
        } else {
            res.status(500).json({ success: false, error: 'Lỗi ghi cấu hình lên đĩa' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Proxy gọi API lấy danh sách VPS
 */
async function getList(req, res) {
    try {
        const config = readConfig();
        if (!config.url) {
            return res.status(400).json({ success: false, error: 'Chưa cấu hình URL máy chủ trung tâm.' });
        }

        const targetUrl = `${config.url}/stats.php?api=list`;
        const headers = {
            'Content-Type': 'application/json'
        };
        if (config.token) {
            headers['X-Secure-Token'] = config.token;
        }

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({
                success: false,
                error: `Máy chủ trung tâm trả về lỗi ${response.status}`,
                details: errText
            });
        }

        const data = await response.json();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Không thể kết nối đến máy chủ giám sát', details: err.message });
    }
}

/**
 * Proxy lấy thông số chi tiết của 1 VPS cụ thể
 */
async function getStats(req, res) {
    try {
        const { ip } = req.query;
        if (!ip) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số IP' });
        }

        const config = readConfig();
        if (!config.url) {
            return res.status(400).json({ success: false, error: 'Chưa cấu hình URL máy chủ trung tâm.' });
        }

        const targetUrl = `${config.url}/stats.php?api=stats&ip=${encodeURIComponent(ip)}`;
        const headers = {
            'Content-Type': 'application/json'
        };
        if (config.token) {
            headers['X-Secure-Token'] = config.token;
        }

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: `Lỗi kết nối máy chủ trung tâm: HTTP ${response.status}`
            });
        }

        const data = await response.json();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Proxy yêu cầu xóa bản ghi cài đặt của VPS
 */
async function deleteRecord(req, res) {
    try {
        const { vpsId } = req.body;
        if (!vpsId) {
            return res.status(400).json({ success: false, error: 'Thiếu tham số vpsId cần xóa' });
        }

        const config = readConfig();
        if (!config.url) {
            return res.status(400).json({ success: false, error: 'Chưa cấu hình URL máy chủ trung tâm.' });
        }

        const targetUrl = `${config.url}/stats.php`;
        
        // stats.php xử lý xóa thông qua POST form-urlencoded
        const bodyParams = new URLSearchParams();
        bodyParams.append('action_delete', '1');
        bodyParams.append('vps_id', vpsId);

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (config.token) {
            headers['X-Secure-Token'] = config.token;
        }

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: bodyParams,
            redirect: 'manual' // Bỏ qua redirect PHP và kiểm tra kết quả ngay
        });

        // 200 OK hoặc 302 Found (Redirect về stats.php sau khi xóa thành công) đều hợp lệ
        if (response.status === 200 || response.status === 302) {
            res.json({ success: true, message: 'Đã xóa bản ghi thành công!' });
        } else {
            res.status(response.status).json({
                success: false,
                error: `Không thể xóa trên máy chủ trung tâm: HTTP ${response.status}`
            });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Hàm lọc sạch các thông tin nhạy cảm trong logs (mật khẩu, database user, salts, keys)
 */
function sanitizeLogs(logText) {
    if (!logText) return '';
    let sanitized = logText;

    // Lọc các chuỗi định dạng mật khẩu phổ biến
    // Ví dụ: db_password = 'xxx', adminPass: 'xxx', password=xxx
    const passwordPatterns = [
        /(password|passwd|pass|pwd|db_pass|db_password|admin_pass|admin_password|pma_password|pma_pass|key|token|auth_key|secure_token|salts|secret)([\s]*[=:][\s]*['"]?)([^\s'"]{4,})/gi,
        /(-p\s+)([^\s]+)/gi  // Lọc tham số mật khẩu dòng lệnh (như mysql -pPassword)
    ];

    passwordPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '$1$2[REDACTED_SECURE_DATA]');
    });

    return sanitized;
}

/**
 * Gửi báo cáo lỗi về máy chủ trung tâm
 */
async function reportBug(req, res) {
    try {
        const { vpsIp, task, logs, details } = req.body;
        const config = readConfig();
        
        if (!config.url) {
            return res.status(400).json({ success: false, error: 'Chưa cấu hình máy chủ trung tâm để gửi báo cáo lỗi tự động.' });
        }

        const ip = vpsIp || 'localhost';
        const targetUrl = `${config.url}/stats.php?api=report_bug`;
        
        // Tiến hành lọc sạch log trước khi truyền tải
        const safeLogs = sanitizeLogs(logs);
        const safeDetails = sanitizeLogs(details);

        const payload = {
            ip,
            task: task || 'N/A',
            logs: safeLogs,
            details: safeDetails,
            timestamp: new Date().toISOString()
        };

        const headers = {
            'Content-Type': 'application/json'
        };
        if (config.token) {
            headers['X-Secure-Token'] = config.token;
        }

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({
                success: false,
                error: `Máy chủ trung tâm trả về lỗi ${response.status}`,
                details: errText
            });
        }

        let data = { success: true };
        try {
            data = await response.json();
        } catch (e) {
            // Trường hợp máy chủ trung tâm không trả về JSON hợp lệ
        }

        res.json({ success: true, message: 'Gửi báo cáo lỗi thành công!', data });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Không thể kết nối đến máy chủ trung tâm để gửi báo cáo', details: err.message });
    }
}

module.exports = {
    getConfig,
    saveConfig,
    getList,
    getStats,
    deleteRecord,
    reportBug
};
