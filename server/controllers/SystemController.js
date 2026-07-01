const { connectionPool } = require('../utils/ssh');
const { sanitizeNumber, sanitizeAlphaNum, escapeShellArg } = require('../utils/security');
const { logActivity } = require('../utils/logger');

/**
 * Lấy thông tin hệ thống
 */
async function getSystemInfo(req, res) {
    try {
        const { vpsConfig } = req.body;

        if (!vpsConfig) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin VPS'
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Get system information in a single combined execution
        const combinedCmd = 'echo "===HOSTNAME===" && hostname && echo "===OS===" && cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\" && echo "===KERNEL===" && uname -r && echo "===UPTIME===" && (uptime -p 2>/dev/null || uptime) && echo "===ARCH===" && uname -m';
        const result = await ssh.executeCommand(combinedCmd);
        const output = result.stdout || '';

        const hostnameMarker = '===HOSTNAME===';
        const osMarker = '===OS===';
        const kernelMarker = '===KERNEL===';
        const uptimeMarker = '===UPTIME===';
        const archMarker = '===ARCH===';

        const hostnameIndex = output.indexOf(hostnameMarker);
        const osIndex = output.indexOf(osMarker);
        const kernelIndex = output.indexOf(kernelMarker);
        const uptimeIndex = output.indexOf(uptimeMarker);
        const archIndex = output.indexOf(archMarker);

        const results = {
            hostname: hostnameIndex !== -1 && osIndex !== -1 ? output.substring(hostnameIndex + hostnameMarker.length, osIndex).trim() : 'N/A',
            os: osIndex !== -1 && kernelIndex !== -1 ? output.substring(osIndex + osMarker.length, kernelIndex).trim() : 'N/A',
            kernel: kernelIndex !== -1 && uptimeIndex !== -1 ? output.substring(kernelIndex + kernelMarker.length, uptimeIndex).trim() : 'N/A',
            uptime: uptimeIndex !== -1 && archIndex !== -1 ? output.substring(uptimeIndex + uptimeMarker.length, archIndex).trim() : 'N/A',
            architecture: archIndex !== -1 ? output.substring(archIndex + archMarker.length).trim() : 'N/A'
        };

        res.json({
            success: true,
            data: results
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy thông tin CPU
 */
async function getCPUInfo(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // CPU usage and info
        const cpuInfo = await ssh.executeCommand(`
      echo "cores: $(nproc)"
      echo "model: $(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2 | xargs)"
      top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print "idle: " $1}'
    `);

        const lines = cpuInfo.stdout.trim().split('\n');
        const data = {};
        lines.forEach(line => {
            const [key, value] = line.split(': ');
            data[key] = value;
        });

        // Calculate usage from idle
        const idle = parseFloat(data.idle) || 0;
        data.usage = (100 - idle).toFixed(2);

        res.json({
            success: true,
            data
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy thông tin RAM
 */
async function getMemoryInfo(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const memInfo = await ssh.executeCommand('free -m | grep Mem');
        const parts = memInfo.stdout.trim().split(/\s+/);

        const data = {
            total: parseInt(parts[1]),
            used: parseInt(parts[2]),
            free: parseInt(parts[3]),
            usage: ((parseInt(parts[2]) / parseInt(parts[1])) * 100).toFixed(2)
        };

        res.json({
            success: true,
            data
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy thông tin Disk
 */
async function getDiskInfo(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const diskInfo = await ssh.executeCommand('df -h / | tail -1');
        const parts = diskInfo.stdout.trim().split(/\s+/);

        const data = {
            filesystem: parts[0],
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usage: parts[4],
            mountpoint: parts[5]
        };

        res.json({
            success: true,
            data
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy danh sách processes
 */
async function getProcesses(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const processInfo = await ssh.executeCommand('ps aux --sort=-%mem | head -20');
        const lines = processInfo.stdout.trim().split('\n');

        // Parse process list
        const processes = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].trim().split(/\s+/);
            processes.push({
                user: parts[0],
                pid: parts[1],
                cpu: parts[2],
                mem: parts[3],
                command: parts.slice(10).join(' ')
            });
        }

        res.json({
            success: true,
            data: processes
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Kill process
 */
async function killProcess(req, res) {
    try {
        const { vpsConfig, pid } = req.body;

        if (!pid) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu PID'
            });
        }

        const safePid = sanitizeNumber(pid);
        if (!safePid) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu hoặc sai PID'
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`kill -9 ${safePid}`);

        res.json({
            success: true,
            message: `Đã dừng process ${safePid}`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy network stats
 */
async function getNetworkInfo(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const netInfo = await ssh.executeCommand(`
      cat /proc/net/dev | grep -E "eth0|ens" | head -1 | awk '{print "rx: "$2" tx: "$10}'
    `);

        const parts = netInfo.stdout.trim().split(' ');
        const data = {
            rx: parts[1],
            tx: parts[3]
        };

        res.json({
            success: true,
            data
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Factory Reset VPS - Clean installed packages
 */
async function cleanPackages(req, res) {
    try {
        const { vpsConfig, confirm } = req.body;

        if (confirm !== 'RESET_PACKAGES') {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng xác nhận bằng cách gửi confirm: "RESET_PACKAGES"'
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Detect OS
        const osRelease = await ssh.executeCommand('cat /etc/os-release');
        const isDebian = osRelease.stdout.includes('Ubuntu') || osRelease.stdout.includes('Debian');

        let cleanCmd;
        if (isDebian) {
            cleanCmd = `
                apt-get autoremove -y
                apt-get autoclean -y
                apt-get clean
            `;
        } else {
            cleanCmd = `
                yum autoremove -y
                yum clean all
            `;
        }

        const result = await ssh.executeCommand(cleanCmd);

        res.json({
            success: true,
            message: 'Đã dọn dẹp packages không cần thiết',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Reset all PM2 applications
 */
async function resetApplications(req, res) {
    try {
        const { vpsConfig, confirm } = req.body;

        if (confirm !== 'RESET_APPS') {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng xác nhận bằng cách gửi confirm: "RESET_APPS"'
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('pm2 delete all && pm2 save --force');

        res.json({
            success: true,
            message: 'Đã xóa tất cả ứng dụng PM2',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Full system update
 */
async function fullSystemUpdate(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Detect OS
        const osRelease = await ssh.executeCommand('cat /etc/os-release');
        const isDebian = osRelease.stdout.includes('Ubuntu') || osRelease.stdout.includes('Debian');

        let updateCmd;
        if (isDebian) {
            updateCmd = `
                apt-get update
                DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
                DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y
                apt-get autoremove -y
                apt-get autoclean -y
            `;
        } else {
            updateCmd = `
                yum update -y
                yum upgrade -y
                yum autoremove -y
            `;
        }

        const result = await ssh.executeCommand(updateCmd);

        res.json({
            success: true,
            message: 'Đã cập nhật toàn bộ hệ thống',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Tự động cập nhật mã nguồn Panel từ Git (update.sh)
 */
async function updatePanel(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        res.json({
            success: true,
            message: 'Tiến trình cập nhật Panel đang chạy ngầm. Hệ thống sẽ khởi động lại và tự tải lại trang sau khoảng 5-10 giây...'
        });

        // Chạy lệnh cập nhật ngầm sau 1 giây
        setTimeout(async () => {
            try {
                console.log('Đang chạy cập nhật Panel qua update.sh...');
                // Chạy script update.sh của panel
                await ssh.executeCommand('chmod +x /var/www/vps-manager/update.sh && bash /var/www/vps-manager/update.sh > /var/log/vps-manager-update.log 2>&1');
            } catch (err) {
                console.error('Lỗi khi chạy update.sh:', err.message);
            }
        }, 1000);

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}


/**
 * Khởi động lại VPS (Reboot)
 */
async function rebootVPS(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Chạy lệnh reboot ngầm để API kịp phản hồi trước khi kết nối đứt
        ssh.executeCommand('sleep 2 && reboot &');

        res.json({
            success: true,
            message: 'VPS đang được khởi động lại. Vui lòng đợi 1-2 phút và tải lại trang.'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Giải phóng RAM Cache
 */
async function cleanSystemCache(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.executeCommand('sync && echo 3 > /proc/sys/vm/drop_caches');

        res.json({
            success: true,
            message: 'Đã giải phóng bộ nhớ RAM đệm (Cache) thành công!'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Dọn dẹp logs rác hệ thống
 */
async function cleanSystemLogs(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`
            journalctl --vacuum-size=50M
            find /var/log -type f -regex '.*\\.\\(gz\\|[0-9]\\)' -delete 2>/dev/null || true
            apt-get clean -y 2>/dev/null || yum clean all -y 2>/dev/null
        `);

        res.json({
            success: true,
            message: 'Đã dọn dẹp logs và tệp tin rác hệ thống thành công!',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Thay đổi mật khẩu đăng nhập SSH
 */
async function changeRootPassword(req, res) {
    try {
        const { vpsConfig, newPassword } = req.body;

        if (!newPassword || newPassword.trim().length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Mật khẩu mới phải có ít nhất 6 ký tự.'
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const username = vpsConfig.username || 'root';
        
        await ssh.executeCommand(`echo "${username}:${newPassword.replace(/"/g, '\\"')}" | chpasswd`);

        res.json({
            success: true,
            message: `Thay đổi mật khẩu cho tài khoản "${username}" thành công!`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy danh sách kiểm tra cấu hình VPS lần đầu
 */
async function getSetupChecklist(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // 1. Kiểm tra Cổng SSH
        const sshdResult = await ssh.executeCommand("grep -i '^port ' /etc/ssh/sshd_config 2>/dev/null || echo 'Port 22'");
        const portMatch = sshdResult.stdout.match(/port\s+(\d+)/i);
        const sshPort = portMatch ? parseInt(portMatch[1]) : 22;
        const isDefaultSSHPort = sshPort === 22;

        // 2. Kiểm tra phần mềm Nginx & MySQL
        const nginxCheck = await ssh.executeCommand('which nginx');
        const mysqlCheck = await ssh.executeCommand('which mysql');
        const hasNginx = nginxCheck.code === 0;
        const hasMySQL = mysqlCheck.code === 0;

        // 3. Kiểm tra lập lịch sao lưu trong cron
        const cronResult = await ssh.executeCommand('crontab -l 2>/dev/null || true');
        const hasBackupSchedules = cronResult.stdout.includes('[BACKUP]');

        // 4. Kiểm tra website đang chạy
        const sitesResult = await ssh.executeCommand('ls -1 /etc/nginx/sites-enabled 2>/dev/null || true');
        const activeSites = sitesResult.stdout.trim().split('\n').filter(s => s && s !== 'default' && s.trim());
        const hasWebsites = activeSites.length > 0;

        res.json({
            success: true,
            data: {
                isPanelProtected: !!process.env.PANEL_PASSWORD,
                isDefaultSSHPort,
                sshPort,
                hasNginx,
                hasMySQL,
                hasBackupSchedules,
                hasWebsites
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Kiểm tra sức khỏe tất cả dịch vụ quan trọng
 */
async function getServiceHealth(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const SERVICES = [
            { id: 'nginx',    name: 'Nginx',       icon: '🌐' },
            { id: 'mysql',    name: 'MySQL',        icon: '🗄️' },
            { id: 'mariadb',  name: 'MariaDB',      icon: '🗄️' },
            { id: 'docker',   name: 'Docker',       icon: '🐳' },
            { id: 'redis',    name: 'Redis',        icon: '⚡' },
            { id: 'mongodb',  name: 'MongoDB',      icon: '🍃' },
            { id: 'fail2ban', name: 'Fail2Ban',     icon: '🛡️' },
            { id: 'ufw',      name: 'UFW Firewall', icon: '🔥' },
        ];

        // Run all checks in parallel via one script
        const script = SERVICES.map(s =>
            `STATUS=$(systemctl is-active ${s.id} 2>/dev/null || echo "not-found"); ` +
            `ENABLED=$(systemctl is-enabled ${s.id} 2>/dev/null || echo "disabled"); ` +
            `echo "${s.id}|$STATUS|$ENABLED"`
        ).join('; ');

        // Also detect php-fpm dynamically - use string concat to avoid JS template literal conflict with bash ${u%.service}
        const phpScript = 'php_fpm=$(systemctl list-units --type=service --state=running 2>/dev/null | grep \'php.*fpm\' | awk \'{print $1}\' | head -3); for u in $php_fpm; do n="${u%.service}"; echo "$n|active|enabled"; done';

        const [result, phpResult] = await Promise.all([
            ssh.executeCommand(script),
            ssh.executeCommand(phpScript)
        ]);

        const services = [];
        const allLines = (result.stdout + '\n' + phpResult.stdout).trim().split('\n').filter(Boolean);

        for (const line of allLines) {
            const [id, status, enabled] = line.split('|');
            if (!id) continue;
            // Skip if not-found AND not a php-fpm service
            if (status === 'not-found' && !id.includes('php')) continue;
            if (status === 'not-found') continue;

            // Find meta
            const meta = SERVICES.find(s => s.id === id) || {
                id, name: id.replace('-', ' ').toUpperCase(), icon: '⚙️'
            };
            services.push({
                id,
                name: meta.name,
                icon: meta.icon,
                active: status === 'active',
                status,
                enabled: enabled === 'enabled' || enabled === 'static'
            });
        }

        res.json({ success: true, data: services });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Khởi động lại một dịch vụ nhanh
 */
async function quickRestartService(req, res) {
    try {
        const { vpsConfig, serviceId, action } = req.body;
        // Whitelist service names
        const safeId = (serviceId || '').replace(/[^a-zA-Z0-9._@-]/g, '');
        if (!safeId) {
            return res.status(400).json({ success: false, error: 'Service ID không hợp lệ' });
        }
        const safeAction = ['start', 'stop', 'restart', 'reload'].includes(action) ? action : 'restart';
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`systemctl ${safeAction} ${safeId} 2>&1; systemctl is-active ${safeId}`);
        const newStatus = result.stdout.trim().split('\n').pop();
        res.json({
            success: true,
            message: `Đã ${safeAction} dịch vụ ${safeId}`,
            status: newStatus
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Configure Panel Domain & Let's Encrypt SSL (HTTPS Reverse Proxy)
 */
async function configurePanelSSL(req, res) {
    try {
        const { vpsConfig, domain, email } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Tên miền không hợp lệ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Lấy port hiện tại của panel đang chạy
        const panelPort = process.env.PORT || 3000;

        // Tạo cấu hình Nginx proxy-pass cho panel
        const nginxConfig = `
server {
    listen 80;
    server_name ${safeDomain};

    location / {
        proxy_pass http://127.0.0.1:${panelPort};
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

        const configPath = `/etc/nginx/sites-available/vps-manager-panel`;

        // Ghi file cấu hình Nginx
        await ssh.executeCommand(`cat > ${configPath} << 'EOF'
${nginxConfig}
EOF`);

        // Kích hoạt config (tạo symlink)
        await ssh.executeCommand(`ln -sf ${configPath} /etc/nginx/sites-enabled/`);

        // Test và reload nginx
        const testNginx = await ssh.executeCommand('nginx -t');
        if (testNginx.code !== 0) {
            throw new Error(`Cấu hình Nginx lỗi: ${testNginx.stderr}`);
        }
        await ssh.executeCommand('systemctl reload nginx');

        // Cài đặt Certbot SSL Let's Encrypt
        const checkCertbot = await ssh.executeCommand('dpkg -l | grep -q python3-certbot-nginx && echo "OK" || echo "NO"');
        if (checkCertbot.stdout.trim() !== 'OK') {
            await ssh.executeCommand('apt-get update && apt-get install -y certbot python3-certbot-nginx');
        }

        const safeEmail = escapeShellArg(email || `admin@${safeDomain}`);
        const certbotResult = await ssh.executeCommand(`certbot --nginx -d ${safeDomain} --non-interactive --agree-tos -m ${safeEmail}`);

        if (certbotResult.code !== 0) {
            throw new Error(`Certbot lỗi: ${certbotResult.stderr || certbotResult.stdout}`);
        }

        logActivity('Cài đặt SSL Panel', `Cài đặt tên miền truy cập ${domain} và SSL Let's Encrypt thành công cho Panel`, vpsConfig.id);

        res.json({
            success: true,
            message: `Cấu hình tên miền và SSL thành công! Bạn có thể truy cập Panel qua https://${safeDomain}`
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Helper to fetch the latest release from GitHub API
 */
function getLatestGitHubRelease() {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const options = {
            hostname: 'api.github.com',
            path: '/repos/Phat-471/vps-manager/releases/latest',
            headers: {
                'User-Agent': 'vps-management-tool'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`GitHub API error: ${res.statusCode}`));
                    }
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Check Panel Update Status and Changelog from Git or GitHub Releases
 */
async function checkPanelUpdateStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Kiểm tra thư mục Git tồn tại
        const checkGit = await ssh.executeCommand('cd /var/www/vps-manager && git rev-parse --is-inside-work-tree');
        const isGitMode = checkGit.code === 0;

        if (isGitMode) {
            // Chạy git fetch để cập nhật danh sách commit mới từ origin
            await ssh.executeCommand('cd /var/www/vps-manager && git fetch');

            // Lấy hash commit hiện tại và hash remote
            const localCommitRes = await ssh.executeCommand('cd /var/www/vps-manager && git rev-parse HEAD');
            const remoteCommitRes = await ssh.executeCommand('cd /var/www/vps-manager && git rev-parse @{u}');
            
            const localCommit = localCommitRes.stdout.trim();
            const remoteCommit = remoteCommitRes.stdout.trim();

            const pkgVersion = require('../../package.json').version;
            const currentVersion = `v${pkgVersion} (Commit: ${localCommit.substring(0, 7)})`;

            const hasUpdate = localCommit !== remoteCommit;
            
            let remoteVersion = pkgVersion;
            const remotePkgRes = await ssh.executeCommand('cd /var/www/vps-manager && git show @{u}:package.json 2>/dev/null');
            if (remotePkgRes.code === 0) {
                try {
                    const remotePkg = JSON.parse(remotePkgRes.stdout);
                    remoteVersion = remotePkg.version;
                } catch (e) {}
            }
            const latestVersion = `v${remoteVersion} (Commit: ${remoteCommit.substring(0, 7)})`;

            let changelog = [];
            if (hasUpdate) {
                // Lấy danh sách các commit mới ở remote chưa được pull về
                const changelogRes = await ssh.executeCommand('cd /var/www/vps-manager && git log HEAD..@{u} --pretty=format:"%h - %s (%cr)"');
                changelog = changelogRes.stdout.trim().split('\n').filter(Boolean);
            }

            return res.json({
                success: true,
                isGitMode: true,
                hasUpdate,
                localCommit,
                remoteCommit,
                currentVersion,
                latestVersion,
                changelog
            });
        } else {
            // Chế độ ZIP/Source (Kiểm tra qua raw package.json trên GitHub main branch)
            const fs = require('fs');
            const path = require('path');
            let pkgVersion = '1.0.0';
            try {
                const pkgPath = path.join(__dirname, '../../package.json');
                pkgVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
            } catch (e) {}
            const currentVersion = `v${pkgVersion}`;

            try {
                const remotePkg = await new Promise((resolve, reject) => {
                    const https = require('https');
                    const options = {
                        hostname: 'raw.githubusercontent.com',
                        path: '/Phat-471/vps-manager/main/package.json',
                        headers: {
                            'User-Agent': 'vps-management-tool'
                        }
                    };

                    https.get(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => {
                            try {
                                if (res.statusCode !== 200) {
                                    return reject(new Error(`GitHub API error: ${res.statusCode}`));
                                }
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    }).on('error', (err) => {
                        reject(err);
                    });
                });

                const latestVersion = `v${remotePkg.version}`;
                const hasUpdate = remotePkg.version !== pkgVersion;
                const changelog = remotePkg.description ? [remotePkg.description] : [`Cập nhật tự động phiên bản mới từ nhánh main`];

                return res.json({
                    success: true,
                    isGitMode: false,
                    hasUpdate,
                    currentVersion,
                    latestVersion,
                    changelog
                });
            } catch (githubErr) {
                return res.json({
                    success: true,
                    isGitMode: false,
                    hasUpdate: false,
                    currentVersion,
                    changelog: [`Cảnh báo: Không thể kiểm tra bản cập nhật mới từ GitHub (${githubErr.message})`]
                });
            }
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getSystemInfo,
    getCPUInfo,
    getMemoryInfo,
    getDiskInfo,
    getNetworkInfo,
    getProcesses,
    killProcess,
    cleanPackages,
    resetApplications,
    fullSystemUpdate,
    rebootVPS,
    cleanSystemCache,
    cleanSystemLogs,
    changeRootPassword,
    getSetupChecklist,
    getServiceHealth,
    quickRestartService,
    updatePanel,
    configurePanelSSL,
    checkPanelUpdateStatus
};
