const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum } = require('../utils/security');

async function listContainers(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Check if docker exists
        const check = await ssh.executeCommand('which docker');
        if (!check.stdout) {
            return res.json({ success: false, error: 'Docker not found' });
        }

        // Get container list with format
        const result = await ssh.executeCommand('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"');
        const containers = result.stdout.trim().split('\n').filter(l => l).map(line => {
            const [id, name, image, status, ports] = line.split('|');
            return { id, name, image, status, ports };
        });

        res.json({ success: true, data: containers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function startContainer(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        const safeId = sanitizeAlphaNum(id);
        if (!safeId) {
            return res.status(400).json({ success: false, error: 'Invalid container ID' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`docker start ${safeId}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function stopContainer(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        const safeId = sanitizeAlphaNum(id);
        if (!safeId) {
            return res.status(400).json({ success: false, error: 'Invalid container ID' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`docker stop ${safeId}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function restartContainer(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        const safeId = sanitizeAlphaNum(id);
        if (!safeId) {
            return res.status(400).json({ success: false, error: 'Invalid container ID' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`docker restart ${safeId}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function removeContainer(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        const safeId = sanitizeAlphaNum(id);
        if (!safeId) {
            return res.status(400).json({ success: false, error: 'Invalid container ID' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`docker rm -f ${safeId}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function getLogs(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        const safeId = sanitizeAlphaNum(id);
        if (!safeId) {
            return res.status(400).json({ success: false, error: 'Invalid container ID' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`docker logs --tail 200 ${safeId}`);
        res.json({ success: true, data: { logs: result.stdout + result.stderr } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

async function pruneDocker(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand('docker system prune -f');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
}

module.exports = {
    listContainers,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    getLogs,
    pruneDocker
};
