const crypto = require('crypto');
const { logActivity } = require('../utils/logger');

// Tạo secret key ngẫu nhiên khi khởi động server
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

/**
 * Băm mật khẩu sử dụng thuật toán PBKDF2/scrypt an toàn tích hợp sẵn của Node.js
 */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Kiểm tra mật khẩu có khớp với mã băm hay không
 */
function verifyPassword(password, storedPassword) {
    if (!storedPassword) return false;
    // Hỗ trợ tương thích ngược mật khẩu dạng text thường (nếu có)
    if (!storedPassword.includes(':')) {
        return password === storedPassword;
    }
    const [salt, hash] = storedPassword.split(':');
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
    } catch {
        return false;
    }
}

/**
 * Tạo token đơn giản dựa trên crypto
 */
function generateToken() {
    // Hết hạn sau 7 ngày
    const payload = JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    return Buffer.from(payload).toString('base64') + '.' + signature;
}

/**
 * Kiểm tra tính hợp lệ của token
 */
function verifyToken(token) {
    try {
        if (!token) return false;
        const [payloadB64, signature] = token.split('.');
        if (!payloadB64 || !signature) return false;
        
        const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);
        
        // Kiểm tra hết hạn
        if (payload.exp < Date.now()) return false;
        
        const hmac = crypto.createHmac('sha256', JWT_SECRET);
        hmac.update(payloadStr);
        const expectedSignature = hmac.digest('hex');
        
        // So sánh an toàn thời gian chống tấn công Timing Attack
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
        return false;
    }
}

/**
 * Kiểm tra trạng thái bảo mật của Panel (có yêu cầu mật khẩu không)
 */
function checkStatus(req, res) {
    const isProtected = !!process.env.PANEL_PASSWORD;
    let isAuthenticated = !isProtected;
    
    if (isProtected) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            isAuthenticated = verifyToken(token);
        }
    }
    
    res.json({ success: true, required: isProtected, authenticated: isAuthenticated });
}

/**
 * Đăng nhập vào Panel
 */
function login(req, res) {
    try {
        const { password } = req.body;
        const requiredPassword = process.env.PANEL_PASSWORD;

        if (!requiredPassword) {
            return res.json({ success: true, message: 'Đăng nhập không yêu cầu mật khẩu', token: null });
        }

        if (verifyPassword(password, requiredPassword)) {
            const token = generateToken();
            logActivity('Đăng nhập Panel', 'Đăng nhập Panel thành công');
            return res.json({ success: true, token });
        } else {
            logActivity('Đăng nhập thất bại', 'Thử đăng nhập Panel thất bại (sai mật khẩu)');
            return res.status(401).json({ success: false, error: 'Mật khẩu đăng nhập Panel không chính xác' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Thiết lập mật khẩu ban đầu cho Panel
 */
function setup(req, res) {
    try {
        const { password } = req.body;
        const fs = require('fs');
        const path = require('path');
        
        if (process.env.PANEL_PASSWORD) {
            return res.status(400).json({ success: false, error: 'Panel đã được thiết lập mật khẩu bảo mật trước đó.' });
        }

        if (!password || password.trim().length < 6) {
            return res.status(400).json({ success: false, error: 'Mật khẩu phải tối thiểu từ 6 ký tự trở lên.' });
        }

        const hashedPassword = hashPassword(password.trim());

        // Ghi mật khẩu vào file .env
        const envPath = path.join(__dirname, '../../.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const lines = envContent.split('\n');
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('PANEL_PASSWORD=')) {
                lines[i] = `PANEL_PASSWORD=${hashedPassword}`;
                found = true;
                break;
            }
        }
        if (!found) {
            lines.push(`PANEL_PASSWORD=${hashedPassword}`);
        }
        
        fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
        process.env.PANEL_PASSWORD = hashedPassword;

        // Tạo token đăng nhập mới luôn cho phiên làm việc hiện tại
        const token = generateToken();
        logActivity('Thiết lập Panel', 'Thiết lập mật khẩu bảo mật Panel thành công');
        return res.json({ success: true, message: 'Thiết lập mật khẩu bảo mật Panel thành công', token });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Đảm bảo khóa mã hóa PANEL_ENCRYPTION_KEY tồn tại trong tệp .env
 */
function ensureEncryptionKey() {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env');
    
    if (process.env.PANEL_ENCRYPTION_KEY) {
        return process.env.PANEL_ENCRYPTION_KEY;
    }
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    const lines = envContent.split('\n');
    let foundKey = null;
    let foundIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('PANEL_ENCRYPTION_KEY=')) {
            foundKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
            foundIndex = i;
            break;
        }
    }
    
    if (foundKey) {
        process.env.PANEL_ENCRYPTION_KEY = foundKey;
        return foundKey;
    }
    
    // Tạo khóa ngẫu nhiên 32-byte
    const newKey = crypto.randomBytes(32).toString('hex');
    if (foundIndex >= 0) {
        lines[foundIndex] = `PANEL_ENCRYPTION_KEY=${newKey}`;
    } else {
        lines.push(`PANEL_ENCRYPTION_KEY=${newKey}`);
    }
    
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
    process.env.PANEL_ENCRYPTION_KEY = newKey;
    return newKey;
}

// Gọi ngay khi load module
ensureEncryptionKey();

/**
 * API: Lấy khóa mã hóa của Panel
 */
function getEncryptionKey(req, res) {
    try {
        const isProtected = !!process.env.PANEL_PASSWORD;
        if (isProtected) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ success: false, error: 'Chưa đăng nhập Panel' });
            }
            const token = authHeader.split(' ')[1];
            if (!verifyToken(token)) {
                return res.status(401).json({ success: false, error: 'Phiên làm việc không hợp lệ' });
            }
        }

        const key = ensureEncryptionKey();
        res.json({ success: true, key });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

}

/**
 * Đổi mật khẩu Panel
 */
function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const fs = require('fs');
        const path = require('path');

        if (!process.env.PANEL_PASSWORD) {
            return res.status(400).json({ success: false, error: 'Chưa thiết lập mật khẩu bảo mật trước đó.' });
        }

        if (!verifyPassword(currentPassword, process.env.PANEL_PASSWORD)) {
            return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không chính xác' });
        }

        if (!newPassword || newPassword.trim().length < 6) {
            return res.status(400).json({ success: false, error: 'Mật khẩu mới phải tối thiểu từ 6 ký tự trở lên' });
        }

        const hashedPassword = hashPassword(newPassword.trim());

        // Ghi mật khẩu vào file .env
        const envPath = path.join(__dirname, '../../.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const lines = envContent.split('\n');
        let found = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('PANEL_PASSWORD=')) {
                lines[i] = `PANEL_PASSWORD=${hashedPassword}`;
                found = true;
                break;
            }
        }
        if (!found) {
            lines.push(`PANEL_PASSWORD=${hashedPassword}`);
        }
        
        fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
        process.env.PANEL_PASSWORD = hashedPassword;

        logActivity('Đổi mật khẩu Panel', 'Thay đổi mật khẩu Panel thành công');
        
        // Tạo token mới cho phiên làm việc hiện tại để duy trì đăng nhập
        const token = generateToken();
        res.json({ success: true, message: 'Đổi mật khẩu Panel thành công', token });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    checkStatus,
    login,
    setup,
    verifyToken,
    getEncryptionKey,
    changePassword
};

