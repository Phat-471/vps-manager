const crypto = require('crypto');

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
            return res.json({ success: true, token });
        } else {
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

        return res.json({ success: true, message: 'Thiết lập mật khẩu bảo mật Panel thành công', token });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    checkStatus,
    login,
    setup,
    verifyToken
};
