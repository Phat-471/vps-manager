const crypto = require('crypto');

// Tạo secret key ngẫu nhiên khi khởi động server
const JWT_SECRET = crypto.randomBytes(32).toString('hex');

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

        if (password === requiredPassword) {
            const token = generateToken();
            return res.json({ success: true, token });
        } else {
            return res.status(401).json({ success: false, error: 'Mật khẩu đăng nhập Panel không chính xác' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    checkStatus,
    login,
    verifyToken
};
