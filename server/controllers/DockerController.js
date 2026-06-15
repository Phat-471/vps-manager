const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg, sanitizeNumber } = require('../utils/security');

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

async function deployContainer(req, res) {
    try {
        const { vpsConfig, name, image, ports, env, volumes, restart } = req.body;

        if (!image) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin Docker Image' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Build command parts safely
        let cmd = 'docker run -d';

        if (name) {
            const safeName = sanitizeAlphaNum(name);
            if (safeName) {
                cmd += ` --name ${safeName}`;
            }
        }

        const allowedRestart = ['no', 'always', 'unless-stopped', 'on-failure'];
        const safeRestart = allowedRestart.includes(restart) ? restart : 'no';
        cmd += ` --restart ${safeRestart}`;

        // Port mapping
        if (Array.isArray(ports)) {
            for (const p of ports) {
                if (typeof p === 'string' && p.trim()) {
                    const parts = p.split(':');
                    const cleanParts = parts.map(x => sanitizeNumber(x.trim())).filter(x => x > 0);
                    if (cleanParts.length > 0) {
                        cmd += ` -p ${cleanParts.join(':')}`;
                    }
                }
            }
        }

        // Volume mapping
        if (Array.isArray(volumes)) {
            for (const v of volumes) {
                if (typeof v === 'string' && v.trim()) {
                    const parts = v.split(':');
                    if (parts.length >= 2) {
                        const hostPath = escapeShellArg(parts[0].trim());
                        const containerPath = escapeShellArg(parts[1].trim());
                        cmd += ` -v ${hostPath}:${containerPath}`;
                    }
                }
            }
        }

        // Environment variables
        if (Array.isArray(env)) {
            for (const item of env) {
                if (item && item.key && item.key.trim()) {
                    const safeKey = sanitizeAlphaNum(item.key.trim());
                    const safeVal = escapeShellArg(item.value || '');
                    if (safeKey) {
                        cmd += ` -e ${safeKey}=${safeVal}`;
                    }
                }
            }
        }

        // Add Image
        cmd += ` ${escapeShellArg(image.trim())}`;

        const result = await ssh.executeCommand(cmd);

        if (result.code !== 0) {
            return res.status(500).json({
                success: false,
                error: 'Triển khai container thất bại',
                details: result.stderr || result.stdout
            });
        }

        res.json({
            success: true,
            data: {
                id: result.stdout.trim(),
                message: 'Triển khai Docker Container thành công!'
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listImages(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('docker images --format "{{.Repository}}|{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}"');
        
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Không thể đọc danh sách images', details: result.stderr });
        }

        const images = result.stdout.trim().split('\n').filter(l => l).map(line => {
            const [repository, tag, id, created, size] = line.split('|');
            return { repository, tag, id, created, size };
        });

        res.json({ success: true, data: images });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function pullImage(req, res) {
    try {
        const { vpsConfig, image } = req.body;
        if (!image || !image.trim()) {
            return res.status(400).json({ success: false, error: 'Thiếu tên Docker Image cần tải' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`docker pull ${escapeShellArg(image.trim())}`);

        if (result.code !== 0) {
            return res.status(500).json({
                success: false,
                error: 'Tải Docker Image thất bại',
                details: result.stderr || result.stdout
            });
        }

        res.json({ success: true, data: { output: result.stdout } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function removeImage(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Thiếu ID/Repository của Image cần xóa' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const target = escapeShellArg(id.trim());
        const result = await ssh.executeCommand(`docker rmi ${target}`);

        if (result.code !== 0) {
            return res.status(500).json({
                success: false,
                error: 'Xóa Docker Image thất bại (Có thể ảnh đang được sử dụng bởi container khác)',
                details: result.stderr || result.stdout
            });
        }

        res.json({ success: true, message: 'Đã xóa Docker Image thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listComposeProjects(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Find docker-compose files
        const findCmd = 'find /var/www /root/docker-apps -maxdepth 3 \\( -name "docker-compose.yml" -o -name "docker-compose.yaml" \\) 2>/dev/null';
        const result = await ssh.executeCommand(findCmd);

        const files = result.stdout.trim().split('\n').filter(l => l);
        const projects = [];

        for (const file of files) {
            const parts = file.split('/');
            const name = parts[parts.length - 2];
            const dir = parts.slice(0, -1).join('/');

            // Check container status
            const psCmd = `cd ${dir} && (docker compose ps -a --format "{{.Names}}|{{.State}}|{{.Status}}" 2>/dev/null || docker-compose ps -a --format "{{.Names}}|{{.State}}|{{.Status}}" 2>/dev/null || docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null)`;
            const psRes = await ssh.executeCommand(psCmd);
            
            projects.push({
                name,
                configPath: file,
                dir,
                status: psRes.stdout.trim() || 'No containers running'
            });
        }

        res.json({ success: true, data: projects });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getComposeConfig(req, res) {
    try {
        const { vpsConfig, configPath } = req.body;
        if (!configPath) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn file cấu hình' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`cat ${escapeShellArg(configPath)}`);
        res.json({ success: true, data: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveComposeConfig(req, res) {
    try {
        const { vpsConfig, projectName, configPath, configContent } = req.body;
        
        let targetFile = configPath;
        let targetDir = '';

        if (!targetFile) {
            const safeName = sanitizeAlphaNum(projectName);
            if (!safeName) {
                return res.status(400).json({ success: false, error: 'Tên dự án không hợp lệ' });
            }
            targetDir = `/var/www/docker-apps/${safeName}`;
            targetFile = `${targetDir}/docker-compose.yml`;
        } else {
            targetDir = targetFile.split('/').slice(0, -1).join('/');
        }

        const base64Content = Buffer.from(configContent).toString('base64');
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            mkdir -p ${targetDir}
            echo "${base64Content}" | base64 -d > ${targetFile}
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Lưu file cấu hình thất bại', details: result.stderr });
        }

        res.json({
            success: true,
            message: 'Đã lưu file cấu hình thành công!',
            data: {
                name: projectName || targetFile.split('/').slice(-2, -1)[0],
                configPath: targetFile,
                dir: targetDir
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function prepareComposeCmd(req, res) {
    try {
        const { vpsConfig, dir, cmd } = req.body;
        if (!dir) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn thư mục dự án' });
        }

        const allowedCmds = ['up', 'down', 'restart', 'logs'];
        if (!allowedCmds.includes(cmd)) {
            return res.status(400).json({ success: false, error: 'Lệnh Compose không hợp lệ' });
        }

        let composeCmd = '';
        if (cmd === 'up') {
            composeCmd = 'docker compose up -d || docker-compose up -d';
        } else if (cmd === 'down') {
            composeCmd = 'docker compose down || docker-compose down';
        } else if (cmd === 'restart') {
            composeCmd = 'docker compose restart || docker-compose restart';
        } else if (cmd === 'logs') {
            composeCmd = 'docker compose logs --tail=100 -f || docker-compose logs --tail=100 -f';
        }

        const command = `
            cd ${escapeShellArg(dir)}
            echo ">> Thực thi: ${composeCmd} trong thư mục ${escapeShellArg(dir)}..."
            ${composeCmd}
        `;

        res.json({
            success: true,
            command: command.trim()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteComposeProject(req, res) {
    try {
        const { vpsConfig, dir } = req.body;
        if (!dir || dir === '/' || dir === '/var/www' || dir === '/root') {
            return res.status(400).json({ success: false, error: 'Thư mục không hợp lệ hoặc không an toàn để xóa' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        // Stop containers first
        await ssh.executeCommand(`cd ${escapeShellArg(dir)} && (docker compose down || docker-compose down)`);
        // Remove directory
        const result = await ssh.executeCommand(`rm -rf ${escapeShellArg(dir)}`);

        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Xóa thư mục dự án thất bại', details: result.stderr });
        }

        res.json({ success: true, message: 'Đã xóa dự án Docker Compose thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listContainers,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    getLogs,
    pruneDocker,
    deployContainer,
    listImages,
    pullImage,
    removeImage,
    listComposeProjects,
    getComposeConfig,
    saveComposeConfig,
    prepareComposeCmd,
    deleteComposeProject
};
