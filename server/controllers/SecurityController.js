const { connectionPool } = require('../utils/ssh');
const { escapeShellArg, sanitizeNumber, sanitizeProto } = require('../utils/security');

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
                const match = line.match(/\\[\\s*(\\d+)\\]\\s+(.*?)\\s+(ALLOW|DENY)\\s+(.*)/);
                if (match) {
                    rules.push({
                        index: match[1],
                        to: match[2].trim(),
                        action: match[3],
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
        const { vpsConfig, port, proto } = req.body;
        const safeProto = sanitizeProto(proto);
        const safePort = escapeShellArg(port);
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = safeProto === 'any' ? `ufw allow ${safePort}` : `ufw allow ${safePort}/${safeProto}`;
        await ssh.executeCommand(cmd);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
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

module.exports = {
    getUFWStatus,
    enableUFW,
    disableUFW,
    addUFWRule,
    deleteUFWRule,
    getFail2BanStatus
};
