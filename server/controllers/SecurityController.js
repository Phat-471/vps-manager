const { connectionPool } = require('../utils/ssh');
const { escapeShellArg, sanitizeNumber, sanitizeProto, isValidIP } = require('../utils/security');

async function getUFWStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const checkInstalled = await ssh.executeCommand('which ufw');
        if (checkInstalled.code !== 0) {
            return res.json({
                success: true,
                data: {
                    installed: false,
                    active: false,
                    rules: []
                }
            });
        }

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
                installed: true,
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
        
        // 1. Kiểm tra / cài đặt UFW nếu chưa có
        const checkUfw = await ssh.executeCommand('which ufw');
        if (checkUfw.code !== 0) {
            const installCmd = `
                if [ -f /etc/debian_version ]; then
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
                else
                    yum install -y epel-release && yum install -y ufw
                fi
            `;
            await ssh.executeCommand(installCmd);
        }

        // Ensure SSH port is open first
        const sshPort = vpsConfig.port || 22;
        await ssh.executeCommand(`ufw allow ${sshPort}/tcp`);
        await ssh.executeCommand('echo "y" | ufw enable');
        await ssh.executeCommand('systemctl enable ufw && systemctl start ufw');
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
        const safeAction = ['allow', 'deny', 'limit', 'reject'].includes(action.toLowerCase()) ? action.toLowerCase() : 'allow';
        const safeFrom = fromIP && fromIP.trim() !== '' ? fromIP.trim() : 'any';

        // Validate IP if not 'any' / 'Anywhere'
        if (safeFrom !== 'any' && safeFrom !== 'Anywhere' && !isValidIP(safeFrom) && !safeFrom.includes('/')) {
            return res.status(400).json({ success: false, error: 'Địa chỉ IP hoặc Subnet nguồn không hợp lệ.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const ports = String(port).split(',').map(p => p.trim()).filter(Boolean);
        if (ports.length === 0) {
            return res.status(400).json({ success: false, error: 'Cổng dịch vụ không hợp lệ.' });
        }

        for (const singlePort of ports) {
            const safePort = escapeShellArg(singlePort);
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
                throw new Error(result.stderr || `Lệnh thực thi UFW thất bại cho cổng ${singlePort}`);
            }
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

        const checkInstalled = await ssh.executeCommand('which fail2ban-client');
        const installed = checkInstalled.code === 0;

        let active = false;
        let jails = [];
        let config = {
            ignoreip: '127.0.0.1/8 ::1',
            bantime: '10m',
            findtime: '10m',
            maxretry: '5'
        };

        if (installed) {
            const result = await ssh.executeCommand('systemctl is-active fail2ban');
            active = result.stdout.trim() === 'active';

            if (active) {
                // Get jails list
                const jailsResult = await ssh.executeCommand('fail2ban-client status');
                const jailListLine = jailsResult.stdout.split('\n').find(line => line.includes('Jail list:'));
                const jailNames = jailListLine
                    ? jailListLine.split('Jail list:')[1].trim().split(/,\s+/).filter(Boolean)
                    : [];

                for (const name of jailNames) {
                    const statusResult = await ssh.executeCommand(`fail2ban-client status ${name}`);
                    const stdout = statusResult.stdout;

                    const currentlyFailedMatch = stdout.match(/Currently failed:\s+(\d+)/);
                    const totalFailedMatch = stdout.match(/Total failed:\s+(\d+)/);
                    const currentlyBannedMatch = stdout.match(/Currently banned:\s+(\d+)/);
                    const totalBannedMatch = stdout.match(/Total banned:\s+(\d+)/);
                    const bannedIpListMatch = stdout.match(/Banned IP list:\s*(.*)/);

                    jails.push({
                        name,
                        currentlyFailed: currentlyFailedMatch ? parseInt(currentlyFailedMatch[1]) : 0,
                        totalFailed: totalFailedMatch ? parseInt(totalFailedMatch[1]) : 0,
                        currentlyBanned: currentlyBannedMatch ? parseInt(currentlyBannedMatch[1]) : 0,
                        totalBanned: totalBannedMatch ? parseInt(totalBannedMatch[1]) : 0,
                        bannedIPs: bannedIpListMatch && bannedIpListMatch[1].trim()
                            ? bannedIpListMatch[1].trim().split(/\s+/)
                            : []
                    });
                }
            }

            // Read configuration from jail.local if it exists, otherwise jail.conf
            const checkLocal = await ssh.executeCommand('test -f /etc/fail2ban/jail.local && echo "OK" || echo "NO"');
            let configContent = '';
            if (checkLocal.stdout.trim() === 'OK') {
                const configResult = await ssh.executeCommand('cat /etc/fail2ban/jail.local');
                configContent = configResult.stdout;
            } else {
                const checkConf = await ssh.executeCommand('test -f /etc/fail2ban/jail.conf && echo "OK" || echo "NO"');
                if (checkConf.stdout.trim() === 'OK') {
                    const configResult = await ssh.executeCommand('cat /etc/fail2ban/jail.conf');
                    configContent = configResult.stdout;
                }
            }

            if (configContent) {
                const defaultRegex = /\[DEFAULT\]([\s\S]*?)(?:\[|$)/i;
                const match = configContent.match(defaultRegex);
                if (match) {
                    const defaultSection = match[1];
                    const ignoreipMatch = defaultSection.match(/^[#\s]*ignoreip\s*=\s*(.*)$/m);
                    const bantimeMatch = defaultSection.match(/^[#\s]*bantime\s*=\s*(.*)$/m);
                    const findtimeMatch = defaultSection.match(/^[#\s]*findtime\s*=\s*(.*)$/m);
                    const maxretryMatch = defaultSection.match(/^[#\s]*maxretry\s*=\s*(.*)$/m);

                    if (ignoreipMatch) config.ignoreip = ignoreipMatch[1].trim();
                    if (bantimeMatch) config.bantime = bantimeMatch[1].trim();
                    if (findtimeMatch) config.findtime = findtimeMatch[1].trim();
                    if (maxretryMatch) config.maxretry = maxretryMatch[1].trim();
                }
            }
        }

        res.json({
            success: true,
            data: {
                installed,
                active,
                jails,
                config
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveFail2BanConfig(req, res) {
    try {
        const { vpsConfig, ignoreip, bantime, findtime, maxretry } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const checkLocal = await ssh.executeCommand('test -f /etc/fail2ban/jail.local && echo "OK" || echo "NO"');
        let content = '';
        if (checkLocal.stdout.trim() === 'OK') {
            const configResult = await ssh.executeCommand('cat /etc/fail2ban/jail.local');
            content = configResult.stdout;
        } else {
            // Write a basic default template first
            content = `[DEFAULT]
# Ban hosts for 10 minutes
bantime = 10m

# A host is banned if it has generated "maxretry" during the last "findtime"
findtime = 10m

# "maxretry" is the number of failures before a host get banned.
maxretry = 5

# "ignoreip" can be an IP address, a CIDR mask or a DNS host. Fail2ban will not
# ban a host which matches an address in this list.
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
`;
        }

        const updateDefaultConfig = (fileContent, key, value) => {
            const defaultRegex = /\[DEFAULT\]([\s\S]*?)(?:\[|$)/i;
            const match = fileContent.match(defaultRegex);
            if (!match) {
                return `[DEFAULT]\n${key} = ${value}\n\n` + fileContent;
            }
            
            const defaultSection = match[1];
            const keyRegex = new RegExp(`^[#\\s]*${key}\\s*=.*$`, 'm');
            
            let newDefaultSection;
            if (keyRegex.test(defaultSection)) {
                newDefaultSection = defaultSection.replace(keyRegex, `${key} = ${value}`);
            } else {
                newDefaultSection = defaultSection.trimEnd() + `\n${key} = ${value}\n\n`;
            }
            
            return fileContent.replace(match[0], `[DEFAULT]${newDefaultSection}`);
        };

        let updatedContent = content;
        if (ignoreip !== undefined) updatedContent = updateDefaultConfig(updatedContent, 'ignoreip', ignoreip);
        if (bantime !== undefined) updatedContent = updateDefaultConfig(updatedContent, 'bantime', bantime);
        if (findtime !== undefined) updatedContent = updateDefaultConfig(updatedContent, 'findtime', findtime);
        if (maxretry !== undefined) updatedContent = updateDefaultConfig(updatedContent, 'maxretry', maxretry);

        await ssh.writeFile('/etc/fail2ban/jail.local', updatedContent);
        await ssh.executeCommand('fail2ban-client reload || systemctl restart fail2ban');

        res.json({ success: true, message: 'Đã cập nhật cấu hình Fail2Ban thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getRawFail2BanConfig(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const checkLocal = await ssh.executeCommand('test -f /etc/fail2ban/jail.local && echo "OK" || echo "NO"');
        let content = '';
        if (checkLocal.stdout.trim() === 'OK') {
            const configResult = await ssh.executeCommand('cat /etc/fail2ban/jail.local');
            content = configResult.stdout;
        } else {
            const checkConf = await ssh.executeCommand('test -f /etc/fail2ban/jail.conf && echo "OK" || echo "NO"');
            if (checkConf.stdout.trim() === 'OK') {
                const configResult = await ssh.executeCommand('cat /etc/fail2ban/jail.conf');
                content = configResult.stdout;
            } else {
                content = `# Cấu hình Fail2Ban trống. Hãy điền các chỉ thị của bạn.\n[DEFAULT]\nbantime = 10m\nfindtime = 10m\nmaxretry = 5\nignoreip = 127.0.0.1/8 ::1\n\n[sshd]\nenabled = true\n`;
            }
        }

        res.json({ success: true, data: content });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveRawFail2BanConfig(req, res) {
    try {
        const { vpsConfig, content } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.writeFile('/etc/fail2ban/jail.local', content);
        await ssh.executeCommand('fail2ban-client reload || systemctl restart fail2ban');

        res.json({ success: true, message: 'Đã lưu cấu hình thô Fail2Ban thành công và tải lại dịch vụ!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function unbanFail2BanIP(req, res) {
    try {
        const { vpsConfig, jail, ip } = req.body;
        if (!jail || !ip) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin jail hoặc IP.' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`fail2ban-client set ${escapeShellArg(jail)} unbanip ${escapeShellArg(ip)}`);
        if (result.code !== 0) {
            throw new Error(result.stderr || `Không thể gỡ chặn IP ${ip} khỏi jail ${jail}`);
        }

        res.json({ success: true, message: `Đã gỡ chặn IP ${ip} thành công!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function banFail2BanIP(req, res) {
    try {
        const { vpsConfig, jail, ip } = req.body;
        if (!jail || !ip) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin jail hoặc IP.' });
        }
        if (!isValidIP(ip.trim())) {
            return res.status(400).json({ success: false, error: 'Địa chỉ IP không hợp lệ.' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`fail2ban-client set ${escapeShellArg(jail)} banip ${escapeShellArg(ip.trim())}`);
        if (result.code !== 0) {
            throw new Error(result.stderr || `Không thể chặn IP ${ip} trong jail ${jail}`);
        }

        res.json({ success: true, message: `Đã chặn IP ${ip} thành công!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function controlFail2BanService(req, res) {
    try {
        const { vpsConfig, action } = req.body;
        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Hành động không hợp lệ.' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`systemctl ${action} fail2ban`);
        if (result.code !== 0) {
            throw new Error(result.stderr || `Lỗi thực hiện lệnh systemctl ${action} fail2ban`);
        }

        res.json({ success: true, message: `Đã thực hiện lệnh ${action} Fail2Ban thành công!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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

        const checkInstalled = await ssh.executeCommand('which ufw');
        if (checkInstalled.code !== 0) {
            return res.json({
                success: true,
                data: {
                    installed: false,
                    active: false,
                    ips: []
                }
            });
        }

        const result = await ssh.executeCommand('ufw status numbered');
        const isActive = result.stdout.includes('Status: active');
        
        const blacklist = [];
        if (isActive) {
            const lines = result.stdout.trim().split('\n');
            lines.forEach(line => {
                const match = line.match(/\[\s*(\d+)\]\s+(.*?)\s+(?:DENY IN|DENY)\s+(\S+)/i);
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
                installed: true,
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
        
        // 1. Kiểm tra / cài đặt UFW nếu chưa có
        const checkUfw = await ssh.executeCommand('which ufw');
        if (checkUfw.code !== 0) {
            const installCmd = `
                if [ -f /etc/debian_version ]; then
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
                else
                    yum install -y epel-release && yum install -y ufw
                fi
            `;
            await ssh.executeCommand(installCmd);
            const checkUfw2 = await ssh.executeCommand('which ufw');
            if (checkUfw2.code !== 0) {
                throw new Error('Tường lửa UFW chưa được cài đặt và không thể tự động cài đặt trên VPS này.');
            }
        }

        // 2. Mở cổng SSH hiện tại trước khi bật tường lửa để tránh bị khóa truy cập
        const sshPort = vpsConfig.port || 22;
        await ssh.executeCommand(`ufw allow ${sshPort}/tcp`);
        
        // 3. Đảm bảo UFW được bật
        await ssh.executeCommand('echo "y" | ufw enable');
        await ssh.executeCommand('systemctl enable ufw && systemctl start ufw');
        
        // 4. Chèn luật chặn lên hàng đầu
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

        const checkInstalled = await ssh.executeCommand('which ufw');
        if (checkInstalled.code !== 0) {
            return res.json({ success: true, message: `Địa chỉ IP ${cleanIP} chưa từng bị chặn (Tường lửa UFW chưa được cài đặt)` });
        }
        
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

        // 1. Kiểm tra / cài đặt UFW nếu chưa có
        const checkUfw = await ssh.executeCommand('which ufw');
        if (checkUfw.code !== 0) {
            const installCmd = `
                if [ -f /etc/debian_version ]; then
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
                else
                    yum install -y epel-release && yum install -y ufw
                fi
            `;
            await ssh.executeCommand(installCmd);
            const checkUfw2 = await ssh.executeCommand('which ufw');
            if (checkUfw2.code !== 0) {
                throw new Error('Tường lửa UFW chưa được cài đặt và không thể tự động cài đặt trên VPS này.');
            }
        }

        // 2. Mở cổng SSH hiện tại trước khi bật tường lửa để tránh bị khóa truy cập
        const sshPort = vpsConfig.port || 22;
        await ssh.executeCommand(`ufw allow ${sshPort}/tcp`);

        // 3. Đảm bảo UFW được bật
        await ssh.executeCommand('echo "y" | ufw enable');
        await ssh.executeCommand('systemctl enable ufw && systemctl start ufw');

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

// ===================== THREAT SCANNER =====================

const MINER_PROCESS_NAMES = [
    'xmrig', 'xmr', 'minerd', 'cpuminer', 'kthreaddadd', 'kthreadd64',
    'kdevtmpfsi', 'kinsing', 'cryptonight', 'monero', 'nanominer',
    'ethminer', 'nbminer', 'teamredminer', 'phoenixminer', 't-rex'
];
const MINING_PORTS = ['3333','4444','5555','7777','8899','14444','45700','14433','3334','9999'];
const MALICIOUS_CRON_PATTERNS = ['curl ', 'wget ', 'bash -i', 'python -c', 'python3 -c', '/tmp/', '/dev/shm/', 'base64 -d', 'chmod +x'];

async function scanThreats(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const threats = { processes: [], cronjobs: [], network: [], files: [] };

        // --- 1. Scan suspicious processes ---
        const psRes = await ssh.executeCommand("ps aux --sort=-%cpu | head -30 | awk 'NR>1 {print $1,$2,$3,$4,$11,$12,$13}'");
        if (psRes.code === 0) {
            psRes.stdout.trim().split('\n').forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 5) return;
                const [user, pid, cpu, mem, ...cmdParts] = parts;
                const cmd = cmdParts.join(' ');
                const cpuNum = parseFloat(cpu);
                const isMinerName = MINER_PROCESS_NAMES.some(n => cmd.toLowerCase().includes(n));
                const isInTmp = cmd.startsWith('/tmp/') || cmd.startsWith('/dev/shm/') || cmd.startsWith('/var/tmp/');
                const isFakeCrond = cmd.includes('crond') && !cmd.startsWith('/usr/sbin/') && !cmd.startsWith('/sbin/');
                const isHighCpu = cpuNum > 40;

                let risk = 'normal';
                let reason = '';
                if (isMinerName) { risk = 'critical'; reason = 'Tên tiến trình khớp mã độc đào coin'; }
                else if (isInTmp && isHighCpu) { risk = 'critical'; reason = 'Chạy từ thư mục tạm + CPU cao'; }
                else if (isInTmp) { risk = 'high'; reason = 'Tiến trình chạy từ thư mục tạm (/tmp, /dev/shm)'; }
                else if (isFakeCrond) { risk = 'critical'; reason = 'crond giả mạo chạy ngoài /usr/sbin/'; }
                else if (isHighCpu && user === 'root' && !cmd.includes('node') && !cmd.includes('mysql') && !cmd.includes('nginx') && !cmd.includes('apache') && !cmd.includes('php')) {
                    risk = 'medium'; reason = `CPU cao bất thường (${cpu}%) với quyền root`;
                }

                if (risk !== 'normal') {
                    threats.processes.push({ pid, user, cpu, mem, cmd, risk, reason });
                }
            });
        }

        // --- 2. Scan malicious cronjobs ---
        const cronSources = [
            { cmd: 'cat /var/spool/cron/crontabs/root 2>/dev/null', source: '/var/spool/cron/crontabs/root' },
            { cmd: 'cat /etc/crontab 2>/dev/null', source: '/etc/crontab' },
            { cmd: 'cat /etc/cron.d/* 2>/dev/null', source: '/etc/cron.d/*' },
        ];
        for (const cronSrc of cronSources) {
            const cronRes = await ssh.executeCommand(cronSrc.cmd);
            if (cronRes.code === 0 && cronRes.stdout.trim()) {
                cronRes.stdout.trim().split('\n').forEach((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;
                    const matchedPattern = MALICIOUS_CRON_PATTERNS.find(p => trimmed.includes(p));
                    if (matchedPattern) {
                        threats.cronjobs.push({
                            source: cronSrc.source,
                            line: trimmed,
                            lineNum: idx + 1,
                            risk: 'high',
                            reason: `Lệnh nguy hiểm trong cronjob: "${matchedPattern}"`
                        });
                    }
                });
            }
        }

        // --- 3. Scan suspicious network connections ---
        const netRes = await ssh.executeCommand("ss -tunp 2>/dev/null | tail -n +2");
        if (netRes.code === 0) {
            netRes.stdout.trim().split('\n').forEach(line => {
                if (!line.trim()) return;
                const isMiningPort = MINING_PORTS.some(port => line.includes(`:${port} `) || line.includes(`:${port}\t`));
                if (isMiningPort) {
                    const portMatch = MINING_PORTS.find(port => line.includes(`:${port}`));
                    threats.network.push({
                        line: line.trim(),
                        risk: 'critical',
                        reason: `Kết nối đến port mining đào coin: ${portMatch}`
                    });
                }
            });
        }

        // --- 4. Scan executable files in temp dirs ---
        const tmpRes = await ssh.executeCommand("find /tmp /var/tmp /dev/shm -maxdepth 2 -type f -executable 2>/dev/null");
        if (tmpRes.code === 0 && tmpRes.stdout.trim()) {
            tmpRes.stdout.trim().split('\n').forEach(filePath => {
                if (!filePath.trim()) return;
                threats.files.push({
                    path: filePath.trim(),
                    risk: 'high',
                    reason: 'File thực thi trong thư mục tạm - dấu hiệu mã độc'
                });
            });
        }

        const totalThreats = threats.processes.length + threats.cronjobs.length + threats.network.length + threats.files.length;
        res.json({ success: true, data: threats, totalThreats });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function killThreatProcess(req, res) {
    try {
        const { vpsConfig, pid } = req.body;
        const safePid = sanitizeNumber(String(pid));
        if (!safePid) return res.status(400).json({ success: false, error: 'PID không hợp lệ' });

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`kill -9 ${safePid} 2>&1`);
        res.json({ success: result.code === 0, message: result.code === 0 ? `Đã diệt tiến trình PID ${safePid}` : result.stderr });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteThreatFile(req, res) {
    try {
        const { vpsConfig, path: filePath } = req.body;
        // Safety: only allow deleting from /tmp, /var/tmp, /dev/shm
        if (!filePath || !(/^\/(?:tmp|var\/tmp|dev\/shm)\//.test(filePath))) {
            return res.status(400).json({ success: false, error: 'Đường dẫn không hợp lệ hoặc không được phép xóa' });
        }
        const safeFile = escapeShellArg(filePath);
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`rm -f ${safeFile} 2>&1`);
        res.json({ success: result.code === 0, message: result.code === 0 ? `Đã xóa file: ${filePath}` : result.stderr });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function cleanMaliciousCron(req, res) {
    try {
        const { vpsConfig, source, lineNum } = req.body;
        const allowedSources = ['/var/spool/cron/crontabs/root', '/etc/crontab'];
        if (!allowedSources.includes(source)) {
            return res.status(400).json({ success: false, error: 'Nguồn cronjob không hợp lệ' });
        }
        const safeNum = sanitizeNumber(String(lineNum));
        if (!safeNum) return res.status(400).json({ success: false, error: 'Số dòng không hợp lệ' });

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`sed -i '${safeNum}d' ${source} 2>&1`);
        res.json({ success: result.code === 0, message: result.code === 0 ? `Đã xóa dòng ${lineNum} trong ${source}` : result.stderr });
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
    applyZones,
    saveFail2BanConfig,
    getRawFail2BanConfig,
    saveRawFail2BanConfig,
    unbanFail2BanIP,
    banFail2BanIP,
    controlFail2BanService,
    scanThreats,
    killThreatProcess,
    deleteThreatFile,
    cleanMaliciousCron
};

