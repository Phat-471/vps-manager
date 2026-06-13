const { SSHConnection } = require('../utils/ssh');

/**
 * Test kết nối VPS
 */
async function testConnection(req, res) {
    try {
        const { host, username, password, port } = req.body;

        if (!host || !username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin kết nối (host, username, password)'
            });
        }

        const sshConfig = {
            host,
            username,
            password,
            port: port || 22
        };

        const ssh = new SSHConnection(sshConfig);

        try {
            // Test connection
            await ssh.connect();

            // Get VPS info
            const osInfo = await ssh.executeCommand('cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || echo "Unknown OS"');
            const hostname = await ssh.executeCommand('hostname');
            const kernel = await ssh.executeCommand('uname -r');
            const uptime = await ssh.executeCommand('uptime -p 2>/dev/null || uptime');

            ssh.disconnect();

            res.json({
                success: true,
                message: 'Kết nối thành công!',
                info: {
                    hostname: hostname.stdout.trim(),
                    kernel: kernel.stdout.trim(),
                    uptime: uptime.stdout.trim(),
                    os: parseOSInfo(osInfo.stdout)
                }
            });

        } catch (err) {
            ssh.disconnect();

            let errorMessage = 'Kết nối thất bại';

            if (err.level === 'client-authentication') {
                errorMessage = 'Sai username hoặc password';
            } else if (err.level === 'client-timeout') {
                errorMessage = 'Timeout - Không thể kết nối đến VPS';
            } else if (err.code === 'ENOTFOUND') {
                errorMessage = 'Không tìm thấy địa chỉ IP/hostname';
            } else if (err.code === 'ECONNREFUSED') {
                errorMessage = 'VPS từ chối kết nối - Kiểm tra SSH service';
            }

            res.status(401).json({
                success: false,
                error: errorMessage,
                details: err.message
            });
        }

    } catch (err) {
        res.status(500).json({
            success: false,
            error: 'Lỗi server',
            details: err.message
        });
    }
}

/**
 * Parse thông tin OS từ output
 */
function parseOSInfo(osOutput) {
    const lines = osOutput.split('\n');
    let osName = 'Unknown';
    let osVersion = '';

    for (const line of lines) {
        if (line.includes('PRETTY_NAME=')) {
            osName = line.split('=')[1].replace(/"/g, '');
            break;
        } else if (line.includes('NAME=') && !osVersion) {
            osName = line.split('=')[1].replace(/"/g, '');
        } else if (line.includes('VERSION=')) {
            osVersion = line.split('=')[1].replace(/"/g, '');
        }
    }

    return osVersion ? `${osName} ${osVersion}` : osName;
}

module.exports = {
    testConnection
};
