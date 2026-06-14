const { connectionPool } = require('../utils/ssh');
const { escapeShellArg, sanitizeNumber, sanitizeProto, isValidIP } = require('../utils/security');

async function getUFWStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('ufw status numbered');
        const isActive = result.stdout.includes('Status: active');

        const rules = [];
        if (isActive) {
            const lines = result.stdout.trim().split('\n').slice(4);
            lines.forEach(line => {
                if (line.includes('(v6)')) return; // Skip v6 for simplicity
                const match = line.match(/\[\s*(\d+)\]\s+(.*?)\s+(ALLOW IN|DENY IN|LIMIT IN|REJECT IN|ALLOW|DENY|LIMIT|REJECT)\s+(.*)/i);
                if (match) {
                    rules.push({
                        index: match[1],
                        to: match[2].trim(),
                        action: match[3].replace(/\s+IN$/i, '').toUpperCase(),
                        from: match[4].trim()
                    });
                }
            });
        }

        res.json({
            success: true,
            data: {
                active: isActive,
                rules: rules
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function enableUFW(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        // Ensure SSH port is open first
        await ssh.executeCommand('ufw allow 22/tcp');
        await ssh.executeCommand('echo "y" | ufw enable');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function disableUFW(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand('ufw disable');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function addUFWRule(req, res) {
    try {
        const { vpsConfig, port, proto, action = 'allow', fromIP = 'any' } = req.body;
        const safeProto = sanitizeProto(proto);
        const safePort = escapeShellArg(port);
        const safeAction = ['allow', 'deny', 'limit', 'reject'].includes(action.toLowerCase()) ? action.toLowerCase() : 'allow';
        const safeFrom = fromIP && fromIP.trim() !== '' ? fromIP.trim() : 'any';

        // Validate IP if not 'any' / 'Anywhere'
        if (safeFrom !== 'any' && safeFrom !== 'Anywhere' && !isValidIP(safeFrom) && !safeFrom.includes('/')) {
            return res.status(400).json({ success: false, error: 'Địa chỉ IP hoặc Subnet nguồn không hợp lệ.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        let cmd = `ufw `;
        if (safeAction === 'limit') {
            if (safeFrom !== 'any' && safeFrom !== 'Anywhere') {
                cmd += `limit from ${escapeShellArg(safeFrom)} to any port ${safePort}`;
                if (safeProto && safeProto !== 'any') {
                    cmd += ` proto ${safeProto}`;
                }
            } else {
                cmd += `limit ${safePort}`;
                if (safeProto && safeProto !== 'any') {
                    cmd += `/${safeProto}`;
                }
            }
        } else {
            cmd += `${safeAction} `;
            if (safeFrom !== 'any' && safeFrom !== 'Anywhere') {
                if (safePort && safePort !== 'any') {
                    if (safeProto && safeProto !== 'any') {
                        cmd += `proto ${safeProto} from ${escapeShellArg(safeFrom)} to any port ${safePort}`;
                    } else {
                        cmd += `from ${escapeShellArg(safeFrom)} to any port ${safePort}`;
                    }
                } else {
                    cmd += `from ${escapeShellArg(safeFrom)}`;
                }
            } else {
                if (safePort && safePort !== 'any') {
                    cmd += `${safePort}`;
                    if (safeProto && safeProto !== 'any') {
                        cmd += `/${safeProto}`;
                    }
                } else {
                    cmd += `any`;
                }
            }
        }

        const result = await ssh.executeCommand(cmd);
        if (result.code !== 0) {
            throw new Error(result.stderr || 'Lệnh thực thi UFW thất bại');
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteUFWRule(req, res) {
    try {
        const { vpsConfig, index } = req.body;
        const safeIndex = sanitizeNumber(index);
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`echo "y" | ufw delete ${safeIndex}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function getFail2BanStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand('systemctl is-active fail2ban');
        res.json({
            success: true,
            data: { active: result.stdout.trim() === 'active' }
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

/**
 * Đổi cổng SSH truy cập máy chủ
 */
async function changeSSHPort(req, res) {
    try {
        const { vpsConfig, newPort } = req.body;
        const portNum = parseInt(newPort);
        if (!portNum || portNum < 1 || portNum > 65535) {
            return res.status(400).json({ success: false, error: 'Cổng SSH mới không hợp lệ. Cổng phải là số trong khoảng 1-65535.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // 1. Thêm luật mở cổng mới trên UFW trước để tránh bị khóa truy cập
        await ssh.executeCommand(`ufw allow ${portNum}/tcp`);

        // 2. Chỉnh sửa file sshd_config
        // Kiểm tra xem đã có chỉ thị Port chưa
        const checkPort = await ssh.executeCommand('grep -E "^[# ]*Port " /etc/ssh/sshd_config');
        if (checkPort.stdout.trim()) {
            // Thay thế chỉ thị Port cũ bằng Port mới
            await ssh.executeCommand(`sed -i -E 's/^[# ]*Port [0-9]+/Port ${portNum}/' /etc/ssh/sshd_config`);
        } else {
            // Append Port mới vào cuối file
            await ssh.executeCommand(`echo "Port ${portNum}" >> /etc/ssh/sshd_config`);
        }

        // 3. Khởi động lại dịch vụ SSH daemon chạy nền để tránh đứt kết nối API đột ngột
        ssh.executeCommand('sleep 1 && (systemctl restart sshd || systemctl restart ssh) &');

        res.json({
            success: true,
            message: `Yêu cầu đổi cổng SSH sang ${portNum} đã được gửi. Dịch vụ SSH đang khởi động lại. Vui lòng cập nhật cổng kết nối trong cài đặt thành ${portNum} để truy cập tiếp.`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function disableSSHPasswordAuth(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const checkFile = await ssh.executeCommand('test -f /etc/ssh/sshd_config && echo "OK" || echo "NO"');
        if (checkFile.stdout.trim() !== 'OK') {
            return res.status(400).json({ success: false, error: 'Không tìm thấy file cấu hình sshd_config' });
        }

        const scripts = [
            `sed -i -E 's/^[# ]*PasswordAuthentication[[:space:]]+(yes|no)/PasswordAuthentication no/' /etc/ssh/sshd_config`,
            `sed -i -E 's/^[# ]*ChallengeResponseAuthentication[[:space:]]+(yes|no)/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config || true`,
            `sed -i -E 's/^[# ]*KbdInteractiveAuthentication[[:space:]]+(yes|no)/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config || true`,
            `if ! grep -q "^PasswordAuthentication" /etc/ssh/sshd_config; then echo "PasswordAuthentication no" >> /etc/ssh/sshd_config; fi`
        ];

        for (const cmd of scripts) {
            await ssh.executeCommand(cmd);
        }

        ssh.executeCommand('sleep 1 && (systemctl restart sshd || systemctl restart ssh) &');

        res.json({
            success: true,
            message: 'Đã vô hiệu hóa đăng nhập bằng mật khẩu SSH thành công! Dịch vụ SSH đang khởi động lại. Từ bây giờ bạn chỉ có thể truy cập qua SSH Key.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installAndEnableFail2Ban(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            if [ -f /etc/debian_version ]; then
                apt-get update && apt-get install -y fail2ban
            else
                yum install -y epel-release && yum install -y fail2ban
            fi
            systemctl enable fail2ban
            systemctl restart fail2ban
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            throw new Error(result.stderr || 'Cài đặt Fail2Ban thất bại.');
        }

        res.json({
            success: true,
            message: 'Đã tải, cài đặt và kích hoạt thành công dịch vụ bảo vệ Fail2Ban!'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Lấy danh sách cổng đang lắng nghe (Listening Ports)
 */
async function getListeningPorts(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        const result = await ssh.executeCommand('ss -tulpn');
        const lines = result.stdout.trim().split('\n');
        
        const ports = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(/\s+/);
            if (parts.length < 5) continue;
            
            const netid = parts[0]; 
            const localAddrAndPort = parts[4]; 
            
            const colonIndex = localAddrAndPort.lastIndexOf(':');
            if (colonIndex === -1) continue;
            
            const ip = localAddrAndPort.substring(0, colonIndex);
            const port = localAddrAndPort.substring(colonIndex + 1);
            
            let processName = '-';
            let pid = '-';
            if (parts[6]) {
                const processStr = parts[6];
                const match = processStr.match(/"([^"]+)",pid=(\d+)/);
                if (match) {
                    processName = match[1];
                    pid = match[2];
                } else {
                    const simpleMatch = processStr.match(/users:\(\("([^"]+)"/);
                    if (simpleMatch) {
                        processName = simpleMatch[1];
                    }
                }
            }
            
            ports.push({
                proto: netid.toUpperCase(),
                ip: ip,
                port: parseInt(port),
                process: processName,
                pid: pid
            });
        }
        
        ports.sort((a, b) => a.port - b.port);
        
        res.json({ success: true, data: ports });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Cấu hình Tên miền và SSL cho chính Panel (chạy cục bộ)
 */
async function configurePanelSSL(req, res) {
    try {
        const { domain, email } = req.body;
        
        if (!domain || !domain.trim()) {
            return res.status(400).json({ success: false, error: 'Thiếu tên miền (domain).' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, error: 'Thiếu email để nhận thông báo Let\'s Encrypt.' });
        }

        const cleanDomain = domain.trim();
        const cleanEmail = email.trim();
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        // 1. Kiểm tra/Cài đặt Nginx
        try {
            await execPromise('which nginx');
        } catch {
            await execPromise('apt-get update && apt-get install -y nginx');
        }

        // 2. Kiểm tra/Cài đặt Certbot
        try {
            await execPromise('which certbot');
        } catch {
            await execPromise('apt-get update && apt-get install -y certbot python3-certbot-nginx');
        }

        // 3. Tạo file cấu hình Nginx reverse proxy
        const fs = require('fs');
        const nginxConfig = `server {
    listen 80;
    server_name ${cleanDomain};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

        const configPath = '/etc/nginx/sites-available/vps-manager-panel';
        const enabledPath = '/etc/nginx/sites-enabled/vps-manager-panel';

        fs.writeFileSync(configPath, nginxConfig, 'utf8');
        
        if (!fs.existsSync(enabledPath)) {
            fs.symlinkSync(configPath, enabledPath);
        }

        await execPromise('nginx -t');
        await execPromise('systemctl reload nginx || systemctl restart nginx');

        // 4. Chạy Certbot xin SSL và cấu hình tự động redirect HTTPS
        const certbotCmd = `certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos --email ${cleanEmail} --redirect`;
        await execPromise(certbotCmd);
        await execPromise('systemctl reload nginx');

        res.json({
            success: true,
            message: `Cấu hình HTTPS thành công cho Panel!`,
            data: {
                domain: cleanDomain,
                url: `https://${cleanDomain}`
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: 'Lỗi cấu hình SSL Panel: ' + err.message });
    }
}

/**
 * Lấy danh sách IP bị chặn bởi UFW
 */
async function getBlacklistIPs(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('ufw status numbered');
        const isActive = result.stdout.includes('Status: active');
        
        const blacklist = [];
        if (isActive) {
            const lines = result.stdout.trim().split('\n');
            lines.forEach(line => {
                const match = line.match(/\[\s*(\d+)\]\s+(.*?)\s+DENY IN\s+(\S+)/);
                if (match) {
                    blacklist.push({
                        index: match[1],
                        to: match[2].trim(),
                        ip: match[3].trim()
                    });
                }
            });
        }

        res.json({
            success: true,
            data: {
                active: isActive,
                ips: blacklist
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Chặn một địa chỉ IP (Thêm vào UFW Deny Rule số 1)
 */
async function blockIP(req, res) {
    try {
        const { vpsConfig, ip } = req.body;
        
        if (!ip) {
            return res.status(400).json({ success: false, error: 'Thiếu địa chỉ IP' });
        }

        const cleanIP = ip.trim();
        if (!isValidIP(cleanIP)) {
            return res.status(400).json({ success: false, error: 'Địa chỉ IP không hợp lệ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        // Đảm bảo UFW được bật
        await ssh.executeCommand('echo "y" | ufw enable');
        
        // Chèn luật chặn lên hàng đầu
        const result = await ssh.executeCommand(`ufw insert 1 deny from ${escapeShellArg(cleanIP)} to any`);
        
        if (result.code !== 0) {
            throw new Error(result.stderr || 'Không thể thiết lập quy tắc chặn trên UFW');
        }

        res.json({ success: true, message: `Đã chặn địa chỉ IP ${cleanIP} thành công` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Gỡ chặn địa chỉ IP
 */
async function unblockIP(req, res) {
    try {
        const { vpsConfig, ip } = req.body;

        if (!ip) {
            return res.status(400).json({ success: false, error: 'Thiếu địa chỉ IP cần gỡ chặn' });
        }

        const cleanIP = ip.trim();
        if (!isValidIP(cleanIP)) {
            return res.status(400).json({ success: false, error: 'Địa chỉ IP không hợp lệ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        const result = await ssh.executeCommand(`ufw delete deny from ${escapeShellArg(cleanIP)} to any`);
        
        if (result.code !== 0) {
            throw new Error(result.stderr || 'Không thể xóa quy tắc chặn trên UFW');
        }

        res.json({ success: true, message: `Đã gỡ chặn địa chỉ IP ${cleanIP} thành công` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

const ZONES_FILE = '/var/www/vps-manager-backups/firewall-zones.json';

async function readZones(ssh) {
    try {
        const exists = await ssh.exists(ZONES_FILE);
        if (!exists) return [];
        const content = await ssh.readFile(ZONES_FILE);
        return JSON.parse(content || '[]');
    } catch {
        return [];
    }
}

async function writeZones(ssh, zones) {
    await ssh.executeCommand('mkdir -p /var/www/vps-manager-backups');
    await ssh.writeFile(ZONES_FILE, JSON.stringify(zones, null, 4));
}

async function listZones(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const zones = await readZones(ssh);
        res.json({ success: true, data: zones });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveZone(req, res) {
    try {
        const { vpsConfig, zone } = req.body;
        if (!zone || !zone.name) {
            return res.status(400).json({ success: false, error: 'Dữ liệu vùng bảo mật không hợp lệ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const zones = await readZones(ssh);

        const newZone = {
            id: zone.id || 'zone_' + Date.now(),
            name: zone.name,
            ips: Array.isArray(zone.ips) ? zone.ips.map(ip => ip.trim()).filter(Boolean) : [],
            ports: Array.isArray(zone.ports) ? zone.ports : [],
            description: zone.description || ''
        };

        const index = zones.findIndex(z => z.id === newZone.id);
        if (index >= 0) {
            zones[index] = newZone;
        } else {
            zones.push(newZone);
        }

        await writeZones(ssh, zones);
        res.json({ success: true, message: 'Đã lưu vùng bảo mật thành công!', data: zones });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteZone(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Thiếu id vùng cần xóa' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        let zones = await readZones(ssh);
        zones = zones.filter(z => z.id !== id);

        await writeZones(ssh, zones);
        res.json({ success: true, message: 'Đã xóa vùng bảo mật thành công!', data: zones });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function applyZones(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const zones = await readZones(ssh);

        await ssh.executeCommand('echo "y" | ufw enable');

        const restrictedPorts = new Set();
        zones.forEach(zone => {
            zone.ports.forEach(p => {
                const portStr = String(p.port).trim();
                const protoStr = p.proto ? p.proto.toLowerCase() : 'any';
                restrictedPorts.add(`${portStr}/${protoStr}`);
            });
        });

        const logs = [];

        for (const rp of restrictedPorts) {
            const [port, proto] = rp.split('/');
            if (proto === 'any') {
                await ssh.executeCommand(`ufw delete allow ${port}`);
            } else {
                await ssh.executeCommand(`ufw delete allow ${port}/${proto}`);
            }
            logs.push(`Đã dọn dẹp quy tắc allow chung cho cổng ${port}/${proto}`);
        }

        for (const zone of zones) {
            for (const ip of zone.ips) {
                for (const p of zone.ports) {
                    const port = String(p.port).trim();
                    const proto = p.proto ? p.proto.toLowerCase() : 'any';

                    let cmd = `ufw allow `;
                    if (proto === 'any') {
                        cmd += `from ${escapeShellArg(ip)} to any port ${port}`;
                    } else {
                        cmd += `proto ${proto} from ${escapeShellArg(ip)} to any port ${port}`;
                    }

                    await ssh.executeCommand(cmd);
                    logs.push(`Cho phép IP ${ip} kết nối đến cổng ${port}/${proto} (Vùng: ${zone.name})`);
                }
            }
        }

        await ssh.executeCommand('ufw reload');

        res.json({
            success: true,
            message: 'Đã áp dụng các vùng bảo mật thành công!',
            data: logs
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getUFWStatus,
    enableUFW,
    disableUFW,
    addUFWRule,
    deleteUFWRule,
    getFail2BanStatus,
    changeSSHPort,
    disableSSHPasswordAuth,
    installAndEnableFail2Ban,
    getListeningPorts,
    configurePanelSSL,
    getBlacklistIPs,
    blockIP,
    unblockIP,
    listZones,
    saveZone,
    deleteZone,
    applyZones
};
