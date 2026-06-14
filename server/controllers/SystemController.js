const { connectionPool } = require('../utils/ssh');
const { sanitizeNumber } = require('../utils/security');

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

        // Get system information
        const commands = {
            hostname: 'hostname',
            os: 'cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"',
            kernel: 'uname -r',
            uptime: 'uptime -p 2>/dev/null || uptime',
            architecture: 'uname -m'
        };

        const results = {};
        for (const [key, cmd] of Object.entries(commands)) {
            const result = await ssh.executeCommand(cmd);
            results[key] = result.stdout.trim();
        }

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

        // Also detect php-fpm dynamically
        const phpScript = `php_fpm=$(systemctl list-units --type=service --state=running 2>/dev/null | grep 'php.*fpm' | awk '{print $1}' | head -3); for u in $php_fpm; do n="${u%.service}"; echo "$n|active|enabled"; done`;

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
    quickRestartService
};
