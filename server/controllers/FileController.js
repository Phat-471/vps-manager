const { connectionPool } = require('../utils/ssh');
const { escapeShellArg } = require('../utils/security');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

/**
 * List files trong thư mục
 */
async function listFiles(req, res) {
    try {
        const { vpsConfig, path: dirPath } = req.body;
        const targetPath = dirPath || '/root';

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // List files với thông tin chi tiết
        const result = await ssh.executeCommand(`
      ls -lAh --time-style=long-iso ${escapeShellArg(targetPath)} 2>/dev/null || echo "ERROR"
    `);

        if (result.stdout.includes('ERROR') || result.stderr) {
            return res.status(400).json({
                success: false,
                error: 'Không thể đọc thư mục'
            });
        }

        const lines = result.stdout.trim().split('\n').slice(1); // Skip total line
        const files = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.trim().split(/\s+/);
            const permissions = parts[0];
            const isDirectory = permissions.startsWith('d');
            const name = parts.slice(7).join(' ');

            files.push({
                name,
                type: isDirectory ? 'directory' : 'file',
                permissions: parts[0],
                size: parts[4],
                modified: `${parts[5]} ${parts[6]}`,
                owner: parts[2]
            });
        }

        res.json({
            success: true,
            data: {
                path: targetPath,
                files
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
 * Đọc nội dung file
 */
async function readFile(req, res) {
    try {
        const { vpsConfig, path: filePath } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const content = await ssh.readFile(filePath);

        res.json({
            success: true,
            data: {
                path: filePath,
                content
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
 * Ghi nội dung vào file
 */
async function writeFile(req, res) {
    try {
        const { vpsConfig, path: filePath, content } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.writeFile(filePath, content);

        res.json({
            success: true,
            message: 'Đã lưu file thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Delete file/folder
 */
async function deleteFile(req, res) {
    try {
        const { vpsConfig, path: targetPath } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`rm -rf ${escapeShellArg(targetPath)}`);

        res.json({
            success: true,
            message: 'Đã xóa thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Rename/move file
 */
async function renameFile(req, res) {
    try {
        const { vpsConfig, oldPath, newPath } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`mv ${escapeShellArg(oldPath)} ${escapeShellArg(newPath)}`);

        res.json({
            success: true,
            message: 'Đã đổi tên thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Create folder
 */
async function createFolder(req, res) {
    try {
        const { vpsConfig, path: folderPath } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`mkdir -p ${escapeShellArg(folderPath)}`);

        res.json({
            success: true,
            message: 'Đã tạo thư mục thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Change permissions
 */
async function chmod(req, res) {
    try {
        const { vpsConfig, path: targetPath, permissions, recursive = false } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const recurseFlag = recursive ? '-R' : '';
        await ssh.executeCommand(`chmod ${recurseFlag} ${escapeShellArg(permissions)} ${escapeShellArg(targetPath)}`);

        res.json({
            success: true,
            message: 'Đã thay đổi quyền thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Change owner
 */
async function chown(req, res) {
    try {
        const { vpsConfig, path: targetPath, owner, group } = req.body;
        if (!owner) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin chủ sở hữu (owner)' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const ownerGroup = group ? `${owner}:${group}` : owner;
        await ssh.executeCommand(`chown -R ${escapeShellArg(ownerGroup)} ${escapeShellArg(targetPath)}`);

        res.json({
            success: true,
            message: 'Đã thay đổi chủ sở hữu thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Upload file
 */
async function uploadFile(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Không có file được upload'
            });
        }

        const vpsConfig = JSON.parse(req.body.vpsConfig);
        const remotePath = req.body.remotePath || '/root';
        const localPath = req.file.path;
        const fileName = req.file.originalname;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const fullRemotePath = path.posix.join(remotePath, fileName);

        await ssh.uploadFile(localPath, fullRemotePath);

        // Clean up local file
        fs.unlinkSync(localPath);

        res.json({
            success: true,
            message: 'Upload thành công',
            path: fullRemotePath
        });

    } catch (err) {
        // Clean up on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Download file
 */
async function downloadFile(req, res) {
    try {
        const { vpsConfig, path: remotePath } = req.body;
        const fileName = path.basename(remotePath);
        const localPath = path.join('uploads', `download_${Date.now()}_${fileName}`);

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.downloadFile(remotePath, localPath);

        res.download(localPath, fileName, (err) => {
            // Clean up after download
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
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
 * Copy file/folder
 */
async function copyFile(req, res) {
    try {
        const { vpsConfig, oldPath, newPath } = req.body;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`cp -r ${escapeShellArg(oldPath)} ${escapeShellArg(newPath)}`);

        res.json({
            success: true,
            message: 'Đã sao chép thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function zipFile(req, res) {
    try {
        const { vpsConfig, sourcePath, zipPath } = req.body;
        if (!sourcePath || !zipPath) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn nguồn hoặc đường dẫn tệp nén' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        let cmd = '';
        if (zipPath.toLowerCase().endsWith('.tar.gz')) {
            const dirName = path.posix.dirname(sourcePath);
            const baseName = path.posix.basename(sourcePath);
            cmd = `tar -czf ${escapeShellArg(zipPath)} -C ${escapeShellArg(dirName)} ${escapeShellArg(baseName)}`;
        } else {
            cmd = `
                if ! command -v zip >/dev/null 2>&1; then
                    if [ -f /etc/debian_version ]; then
                        apt-get update && apt-get install -y zip
                    else
                        yum install -y zip
                    fi
                fi
                zip -r ${escapeShellArg(zipPath)} ${escapeShellArg(sourcePath)}
            `;
        }
        
        const result = await ssh.executeCommand(cmd);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Nén tệp tin thất bại', details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: 'Đã nén tệp tin thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function unzipFile(req, res) {
    try {
        const { vpsConfig, zipPath, destPath } = req.body;
        if (!zipPath || !destPath) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn tệp nén hoặc thư mục đích' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        let cmd = '';
        if (zipPath.toLowerCase().endsWith('.tar.gz')) {
            cmd = `tar -xzf ${escapeShellArg(zipPath)} -C ${escapeShellArg(destPath)}`;
        } else {
            cmd = `
                if ! command -v unzip >/dev/null 2>&1; then
                    if [ -f /etc/debian_version ]; then
                        apt-get update && apt-get install -y unzip
                    else
                        yum install -y unzip
                    fi
                fi
                unzip -o ${escapeShellArg(zipPath)} -d ${escapeShellArg(destPath)}
            `;
        }
        
        const result = await ssh.executeCommand(cmd);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Giải nén tệp tin thất bại', details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: 'Đã giải nén tệp tin thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Lấy kích thước folder
 */
async function getFolderSize(req, res) {
    try {
        const { vpsConfig, path: folderPath } = req.body;
        if (!folderPath) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn thư mục' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`du -sh ${escapeShellArg(folderPath)} 2>/dev/null || echo "N/A"`);
        const size = result.stdout.trim().split(/\s+/)[0] || 'N/A';
        res.json({ success: true, data: size });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listFiles,
    readFile,
    writeFile,
    deleteFile,
    renameFile,
    createFolder,
    chmod,
    chown,
    uploadFile: [upload.single('file'), uploadFile],
    downloadFile,
    copyFile,
    zipFile,
    unzipFile,
    getFolderSize
};

