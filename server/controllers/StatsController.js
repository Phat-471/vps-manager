const fs = require('fs');
const path = require('path');
const { connectionPool } = require('../utils/ssh');
const { escapeShellArg } = require('../utils/security');

// Regex chuẩn Nginx Combined Log Format
const LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+)\s+(.*?)\s+HTTP\/[^"]*" (\d+) (\d+|-)(?:\s+"([^"]*)"\s+"([^"]*)")?/;

/**
 * API: Liệt kê các file log Nginx khả dụng trên VPS
 */
async function listLogFiles(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('find /var/log/nginx/ -name "*.log" -type f 2>/dev/null || true');
        const files = result.stdout.trim().split('\n').filter(Boolean);

        res.json({
            success: true,
            data: files
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Lấy thống kê chi tiết từ tệp tin log chỉ định
 */
async function getTrafficStats(req, res) {
    try {
        const { vpsConfig, logPath = '/var/log/nginx/access.log' } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Đọc 15,000 dòng log cuối cùng
        const command = `tail -n 15000 ${escapeShellArg(logPath)}`;
        const result = await ssh.executeCommand(command);

        if (result.code !== 0) {
            return res.status(400).json({
                success: false,
                error: `Không thể đọc tệp log: ${result.stderr || 'Tệp không tồn tại hoặc không đủ quyền truy cập'}`
            });
        }

        const lines = result.stdout.split('\n');
        
        let totalRequests = 0;
        let totalBandwidth = 0;
        const uniqueIPs = new Set();
        let errorCount = 0;

        const statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
        const pathsMap = {};
        const ipsMap = {};
        const userAgentsMap = {};
        const hourlyRequests = Array(24).fill(0);

        // Danh sách định nghĩa bot để nhận diện nhanh
        const botKeywords = ['bot', 'crawler', 'spider', 'ahrefs', 'semrush', 'python', 'curl', 'wget', 'scan'];
        const ipDetailsMap = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const match = trimmed.match(LOG_REGEX);
            if (!match) continue;

            totalRequests++;

            const ip = match[1];
            const timeStr = match[2];
            const method = match[3];
            const path = match[4];
            const status = parseInt(match[5]);
            const bytes = match[6] === '-' ? 0 : parseInt(match[6]);
            const referer = match[7] || '';
            const ua = match[8] || '';

            // 1. Thống kê Băng thông & IP
            totalBandwidth += bytes;
            uniqueIPs.add(ip);

            // 2. Thống kê Mã HTTP
            if (status >= 200 && status < 300) statusCodes['2xx']++;
            else if (status >= 300 && status < 400) statusCodes['3xx']++;
            else if (status >= 400 && status < 500) {
                statusCodes['4xx']++;
                errorCount++;
            } else if (status >= 500 && status < 600) {
                statusCodes['5xx']++;
                errorCount++;
            }

            // 3. Thống kê theo Đường dẫn URL (loại trừ file tĩnh phụ để tránh loãng)
            if (!path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
                pathsMap[path] = (pathsMap[path] || 0) + 1;
            }

            // 4. Thống kê IP
            ipsMap[ip] = (ipsMap[ip] || 0) + 1;

            // 5. Phân tích User Agent & nhận dạng Bot
            let uaKey = 'Chrome / Firefox / Safari';
            const uaLower = ua.toLowerCase();
            const matchedBot = botKeywords.find(keyword => uaLower.includes(keyword));
            
            if (!ipDetailsMap[ip]) {
                ipDetailsMap[ip] = { isBot: false };
            }

            if (matchedBot) {
                uaKey = `Bot: ${matchedBot.charAt(0).toUpperCase() + matchedBot.slice(1)}`;
                ipDetailsMap[ip].isBot = true;
            } else if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) {
                uaKey = 'Mobile Device';
            }
            userAgentsMap[uaKey] = (userAgentsMap[uaKey] || 0) + 1;

            // 6. Thống kê theo Giờ
            const hourParts = timeStr.split(':');
            if (hourParts.length >= 2) {
                const hour = parseInt(hourParts[1]);
                if (hour >= 0 && hour < 24) {
                    hourlyRequests[hour]++;
                }
            }
        }

        // Sắp xếp và lấy Top 10 URL
        const topPaths = Object.entries(pathsMap)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Sắp xếp và lấy Top 10 IP
        const topIPsRaw = Object.entries(ipsMap)
            .map(([ip, count]) => ({ ip, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Truy vấn GeoIP cho Top 10 IP
        const ipList = topIPsRaw.map(item => item.ip);
        let geoData = [];
        try {
            if (ipList.length > 0) {
                const response = await fetch('http://ip-api.com/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ipList.map(ip => ({ query: ip })))
                });
                if (response.ok) {
                    geoData = await response.json();
                }
            }
        } catch (err) {
            console.error('GeoIP lookup failed:', err.message);
        }

        const geoMap = {};
        if (Array.isArray(geoData)) {
            geoData.forEach(item => {
                if (item && item.status === 'success') {
                    geoMap[item.query] = item;
                }
            });
        }

        const topIPs = topIPsRaw.map(item => {
            const ip = item.ip;
            const geo = geoMap[ip] || {};
            const details = ipDetailsMap[ip] || { isBot: false };
            const orgLower = (geo.org || geo.isp || '').toLowerCase();
            const isDatacenter = orgLower.includes('hosting') || orgLower.includes('datacenter') || orgLower.includes('server') || orgLower.includes('amazon') || orgLower.includes('google') || orgLower.includes('microsoft') || orgLower.includes('ovh') || orgLower.includes('digitalocean') || orgLower.includes('hetzner') || orgLower.includes('cloudflare');
            const isBot = details.isBot || isDatacenter;

            return {
                ip,
                count: item.count,
                country: geo.country || 'N/A',
                countryCode: geo.countryCode || '',
                org: geo.org || geo.isp || 'N/A',
                isBot,
                type: isBot ? 'Bot/Datacenter' : 'Người dùng'
            };
        });

        // Sắp xếp và lấy User Agent
        const topUserAgents = Object.entries(userAgentsMap)
            .map(([ua, count]) => ({ ua, count }))
            .sort((a, b) => b.count - a.count);

        res.json({
            success: true,
            data: {
                totalRequests,
                uniqueVisitors: uniqueIPs.size,
                totalBandwidthBytes: totalBandwidth,
                errorRate: totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(1) : '0.0',
                statusCodes,
                topPaths,
                topIPs,
                topUserAgents,
                hourlyRequests
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getHistoricalStats(req, res) {
    try {
        const { vpsConfig } = req.body;
        if (!vpsConfig || !vpsConfig.id) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu cấu hình VPS hoặc ID VPS'
            });
        }

        const historyFile = path.join(__dirname, `../data/vps_history_${vpsConfig.id}.json`);
        let history = [];

        if (fs.existsSync(historyFile)) {
            const raw = fs.readFileSync(historyFile, 'utf8');
            try {
                history = JSON.parse(raw);
            } catch (e) {
                history = [];
            }
        }

        res.json({
            success: true,
            data: history
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listLogFiles,
    getTrafficStats,
    getHistoricalStats
};
