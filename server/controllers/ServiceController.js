const { connectionPool } = require('../utils/ssh');

// Danh sách services phổ biến
const COMMON_SERVICES = [
    'nginx',
    'apache2',
    'mysql',
    'mariadb',
    'postgresql',
    'redis',
    'mongodb',
    'php-fpm',
    'php7.4-fpm',
    'php8.0-fpm',
    'php8.1-fpm',
    'php8.2-fpm',
    'docker',
    'ssh',
    'sshd',
    'fail2ban',
    'ufw',
    'postfix',
    'dovecot'
];

/**
 * Detect service manager (systemd or init.d)
 */
async function detectServiceManager(ssh) {
    const result = await ssh.executeCommand('which systemctl');
    return result.stdout.trim() ? 'systemd' : 'initd';
}

/**
 * List services
 */
async function listServices(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const serviceManager = await detectServiceManager(ssh);
        const services = [];

        for (const serviceName of COMMON_SERVICES) {
            let statusCmd;

            if (serviceManager === 'systemd') {
                statusCmd = `systemctl show -p LoadState ${serviceName} 2>/dev/null | grep -q "LoadState=loaded" && (systemctl is-active ${serviceName} >/dev/null 2>&1 && echo "active" || echo "inactive") || echo "not-found"`;
            } else {
                statusCmd = `[ -f /etc/init.d/${serviceName} ] && (service ${serviceName} status >/dev/null 2>&1 && echo "running" || echo "stopped") || echo "not-found"`;
            }

            const result = await ssh.executeCommand(statusCmd);
            const status = result.stdout.trim();

            if (status !== 'not-found') {
                services.push({
                    name: serviceName,
                    status: status === 'active' || status === 'running' ? 'running' : 'stopped',
                    enabled: await isServiceEnabled(ssh, serviceName, serviceManager)
                });
            }
        }

        res.json({
            success: true,
            data: services
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Check if service is enabled at boot
 */
async function isServiceEnabled(ssh, serviceName, serviceManager) {
    try {
        if (serviceManager === 'systemd') {
            const result = await ssh.executeCommand(`systemctl is-enabled ${serviceName} 2>/dev/null`);
            return result.stdout.trim() === 'enabled';
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Get service status
 */
async function getServiceStatus(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const serviceManager = await detectServiceManager(ssh);
        let statusCmd;

        if (serviceManager === 'systemd') {
            statusCmd = `systemctl status ${service}`;
        } else {
            statusCmd = `service ${service} status`;
        }

        const result = await ssh.executeCommand(statusCmd);

        res.json({
            success: true,
            data: {
                service,
                output: result.stdout + result.stderr
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Start service
 */
async function startService(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const serviceManager = await detectServiceManager(ssh);
        const cmd = serviceManager === 'systemd'
            ? `systemctl start ${service}`
            : `service ${service} start`;

        await ssh.executeCommand(cmd);

        res.json({
            success: true,
            message: `Đã khởi động ${service}`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Stop service
 */
async function stopService(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const serviceManager = await detectServiceManager(ssh);
        const cmd = serviceManager === 'systemd'
            ? `systemctl stop ${service}`
            : `service ${service} stop`;

        await ssh.executeCommand(cmd);

        res.json({
            success: true,
            message: `Đã dừng ${service}`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Restart service
 */
async function restartService(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const serviceManager = await detectServiceManager(ssh);
        const cmd = serviceManager === 'systemd'
            ? `systemctl restart ${service}`
            : `service ${service} restart`;

        await ssh.executeCommand(cmd);

        res.json({
            success: true,
            message: `Đã khởi động lại ${service}`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Enable service at boot
 */
async function enableService(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.executeCommand(`systemctl enable ${service}`);

        res.json({
            success: true,
            message: `Đã bật tự động khởi động cho ${service}`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Disable service at boot
 */
async function disableService(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.executeCommand(`systemctl disable ${service}`);

        res.json({
            success: true,
            message: `Đã tắt tự động khởi động cho ${service}`
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Get service logs
 */
async function getServiceLogs(req, res) {
    try {
        const { vpsConfig, service } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`journalctl -u ${service} -n 100 --no-pager 2>/dev/null || tail -n 100 /var/log/${service}.log 2>/dev/null || echo "No logs available"`);

        res.json({
            success: true,
            data: {
                service,
                logs: result.stdout
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

module.exports = {
    listServices,
    getServiceStatus,
    startService,
    stopService,
    restartService,
    enableService,
    disableService,
    getServiceLogs
};
