const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { connectionPool } = require('../utils/ssh');
const { escapeShellArg } = require('../utils/security');
const { getIo } = require('../utils/alertDaemon');

const webhooksFilePath = path.join(__dirname, '../data/webhooks.json');

// Đảm bảo file webhooks.json tồn tại
function loadWebhooks() {
    try {
        if (!fs.existsSync(path.dirname(webhooksFilePath))) {
            fs.mkdirSync(path.dirname(webhooksFilePath), { recursive: true });
        }
        if (!fs.existsSync(webhooksFilePath)) {
            fs.writeFileSync(webhooksFilePath, JSON.stringify([], null, 4));
            return [];
        }
        const data = fs.readFileSync(webhooksFilePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('Lỗi khi đọc file webhooks.json:', err.message);
        return [];
    }
}

function saveWebhooks(webhooks) {
    try {
        fs.writeFileSync(webhooksFilePath, JSON.stringify(webhooks, null, 4));
        return true;
    } catch (err) {
        console.error('Lỗi khi ghi file webhooks.json:', err.message);
        return false;
    }
}

/**
 * Lấy danh sách Webhooks (đã ẩn mật khẩu VPS để bảo mật)
 */
async function listWebhooks(req, res) {
    try {
        const webhooks = loadWebhooks();
        // Ẩn thông tin password VPS trước khi trả về client
        const safeWebhooks = webhooks.map(w => {
            const safeWebhook = { ...w };
            if (safeWebhook.vpsConfig && safeWebhook.vpsConfig.password) {
                safeWebhook.vpsConfig = { ...safeWebhook.vpsConfig };
                safeWebhook.vpsConfig.password = '********';
            }
            return safeWebhook;
        });

        res.json({
            success: true,
            data: safeWebhooks
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Tạo mới Webhook
 */
async function createWebhook(req, res) {
    try {
        const { name, vpsId, vpsConfig, targetType, targetName, appPath, gitBranch, webhookSecret, customCommand } = req.body;

        if (!name || !vpsConfig || !targetType || !targetName || !appPath) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin bắt buộc: name, vpsConfig, targetType, targetName, appPath'
            });
        }

        const webhooks = loadWebhooks();
        
        const newWebhook = {
            id: crypto.randomBytes(16).toString('hex'),
            name,
            vpsId: vpsId || vpsConfig.host,
            vpsConfig,
            targetType, // 'nodeapp' | 'webserver'
            targetName, // pm2 app name hoặc domain Nginx
            appPath,
            gitBranch: gitBranch || 'main',
            webhookSecret: webhookSecret || crypto.randomBytes(12).toString('hex'),
            customCommand: customCommand || '',
            createdAt: new Date().toISOString(),
            lastTriggered: null,
            lastStatus: 'never',
            history: []
        };

        webhooks.push(newWebhook);
        saveWebhooks(webhooks);

        // Trả về webhook đã tạo (ẩn password)
        const safeWebhook = { ...newWebhook };
        safeWebhook.vpsConfig = { ...safeWebhook.vpsConfig, password: '********' };

        res.json({
            success: true,
            message: 'Đã tạo Git Webhook thành công!',
            data: safeWebhook
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Cập nhật Webhook
 */
async function updateWebhook(req, res) {
    try {
        const { id, name, vpsConfig, targetType, targetName, appPath, gitBranch, webhookSecret, customCommand } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Thiếu Webhook ID' });
        }

        const webhooks = loadWebhooks();
        const index = webhooks.findIndex(w => w.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy Webhook' });
        }

        const existing = webhooks[index];

        // Nếu client gửi password là '********', giữ lại password cũ
        let updatedVpsConfig = { ...vpsConfig };
        if (vpsConfig && vpsConfig.password === '********') {
            updatedVpsConfig.password = existing.vpsConfig.password;
        }

        webhooks[index] = {
            ...existing,
            name: name || existing.name,
            vpsConfig: vpsConfig ? updatedVpsConfig : existing.vpsConfig,
            targetType: targetType || existing.targetType,
            targetName: targetName || existing.targetName,
            appPath: appPath || existing.appPath,
            gitBranch: gitBranch || existing.gitBranch,
            webhookSecret: webhookSecret !== undefined ? webhookSecret : existing.webhookSecret,
            customCommand: customCommand !== undefined ? customCommand : existing.customCommand
        };

        saveWebhooks(webhooks);

        const safeWebhook = { ...webhooks[index] };
        safeWebhook.vpsConfig = { ...safeWebhook.vpsConfig, password: '********' };

        res.json({
            success: true,
            message: 'Đã cập nhật Webhook thành công!',
            data: safeWebhook
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Xóa Webhook
 */
async function deleteWebhook(req, res) {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Thiếu Webhook ID' });
        }

        let webhooks = loadWebhooks();
        const initialLength = webhooks.length;
        webhooks = webhooks.filter(w => w.id !== id);

        if (webhooks.length === initialLength) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy Webhook để xóa' });
        }

        saveWebhooks(webhooks);

        res.json({
            success: true,
            message: 'Đã xóa Webhook thành công!'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Xác minh chữ ký GitHub/GitLab
 */
function verifySignature(req, secret) {
    if (!secret) return true; // Không cấu hình secret thì bỏ qua check

    const githubSignature = req.headers['x-hub-signature-256'];
    const gitlabToken = req.headers['x-gitlab-token'];

    if (githubSignature) {
        const parts = githubSignature.split('=');
        if (parts[0] !== 'sha256') return false;
        const sig = parts[1];
        if (!sig) return false;

        const hmac = crypto.createHmac('sha256', secret);
        const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
        const digest = hmac.update(payload).digest('hex');

        try {
            return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(digest, 'hex'));
        } catch (e) {
            return false;
        }
    }

    if (gitlabToken) {
        return gitlabToken === secret;
    }

    return false;
}

/**
 * Kích hoạt deploy thủ công từ UI
 */
async function triggerManual(req, res) {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Thiếu Webhook ID' });
        }

        const webhooks = loadWebhooks();
        const webhook = webhooks.find(w => w.id === id);

        if (!webhook) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy Webhook' });
        }

        const commitInfo = {
            id: 'manual',
            message: 'Chạy deploy thủ công từ Dashboard',
            author: 'Administrator'
        };

        // Kích hoạt tiến trình chạy ngầm
        executeDeploy(webhook, commitInfo);

        res.json({
            success: true,
            message: 'Đã kích hoạt tiến trình deploy ngầm thành công!'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Xử lý webhook deploy từ các git provider
 */
async function handleDeploy(req, res) {
    try {
        const { webhookId } = req.params;
        const webhooks = loadWebhooks();
        const webhook = webhooks.find(w => w.id === webhookId);

        if (!webhook) {
            return res.status(404).json({ success: false, error: 'Webhook không hợp lệ' });
        }

        // Xác minh chữ ký bảo mật
        if (!verifySignature(req, webhook.webhookSecret)) {
            console.warn(`[Webhook] Xác thực thất bại cho Webhook ID: ${webhookId}`);
            return res.status(401).json({ success: false, error: 'Chữ ký Webhook hoặc Token không hợp lệ' });
        }

        // Parse thông tin branch từ payload
        const pushBranch = req.body.ref ? req.body.ref.replace('refs/heads/', '') : null;
        if (pushBranch && webhook.gitBranch && pushBranch !== webhook.gitBranch) {
            console.log(`[Webhook] Bỏ qua vì branch đẩy lên '${pushBranch}' không phải '${webhook.gitBranch}'`);
            return res.json({
                success: true,
                message: `Branch '${pushBranch}' ignored. Configured branch is '${webhook.gitBranch}'`
            });
        }

        // Trích xuất thông tin commit từ payload
        const commits = req.body.commits || [];
        let commitInfo = null;

        if (req.body.head_commit) {
            commitInfo = {
                id: req.body.head_commit.id ? req.body.head_commit.id.substring(0, 7) : 'unknown',
                message: req.body.head_commit.message || 'No commit message',
                author: req.body.head_commit.author ? req.body.head_commit.author.name : 'Unknown'
            };
        } else if (commits.length > 0) {
            const latest = commits[0];
            commitInfo = {
                id: latest.id ? latest.id.substring(0, 7) : 'unknown',
                message: latest.message || 'No commit message',
                author: latest.author ? latest.author.name : 'Unknown'
            };
        } else {
            commitInfo = {
                id: 'push',
                message: 'Git push trigger',
                author: req.body.pusher ? (req.body.pusher.name || req.body.pusher.email) : 'Git Provider'
            };
        }

        // Trả về mã 202 Accepted cho GitHub/GitLab ngay lập tức để tránh timeout (thường là 10s)
        res.status(202).json({
            success: true,
            message: 'Đã nhận được push event. Tiến trình deploy đang chạy ngầm...'
        });

        // Kích hoạt tiến trình deploy
        executeDeploy(webhook, commitInfo);

    } catch (err) {
        console.error('Lỗi khi xử lý webhook deploy:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
}

/**
 * Thực thi deploy ngầm bằng SSH lệnh
 */
async function executeDeploy(webhook, commitInfo) {
    let ssh = null;
    let output = '';
    let success = false;

    console.log(`[AutoDeploy] Bắt đầu deploy cho ${webhook.name} (${webhook.targetName})`);

    try {
        ssh = await connectionPool.getConnection(webhook.vpsId, webhook.vpsConfig);

        let script = '';

        if (webhook.targetType === 'nodeapp') {
            script = `
                set -e
                cd ${escapeShellArg(webhook.appPath)} || { echo "LỖI: Không tìm thấy thư mục ${webhook.appPath}"; exit 1; }
                
                echo "=== [$(date)] BẮT ĐẦU TỰ ĐỘNG DEPLOY NODEJS APP ==="
                echo "1. Đang pull code mới từ Git..."
                git fetch --all
                git reset --hard origin/${escapeShellArg(webhook.gitBranch || 'main')}

                # Load môi trường NVM
                export NVM_DIR="$HOME/.nvm"
                if [ -s "$NVM_DIR/nvm.sh" ]; then
                    . "$NVM_DIR/nvm.sh"
                elif [ -s "/home/pm2user/.nvm/nvm.sh" ]; then
                    export NVM_DIR="/home/pm2user/.nvm"
                    . "$NVM_DIR/nvm.sh"
                fi

                echo "2. Cài đặt các thư viện npm..."
                if [ -f "package.json" ]; then
                    npm install --production || npm install
                fi

                ${webhook.customCommand ? `echo "3. Thực thi lệnh build tùy chỉnh..."\n${webhook.customCommand}` : ''}

                echo "4. Reload/Restart PM2 service..."
                if command -v pm2 &> /dev/null; then
                    pm2 reload ${escapeShellArg(webhook.targetName)} || pm2 restart ${escapeShellArg(webhook.targetName)}
                elif id -u pm2user &>/dev/null && sudo -u pm2user -i command -v pm2 &> /dev/null; then
                    sudo -u pm2user -i pm2 reload ${escapeShellArg(webhook.targetName)} || sudo -u pm2user -i pm2 restart ${escapeShellArg(webhook.targetName)}
                else
                    sudo -u pm2user pm2 reload ${escapeShellArg(webhook.targetName)} || sudo -u pm2user pm2 restart ${escapeShellArg(webhook.targetName)} || pm2 reload ${escapeShellArg(webhook.targetName)}
                fi
                
                echo "5. Phân quyền cho pm2user..."
                chown -R pm2user:pm2user ${escapeShellArg(webhook.appPath)} 2>/dev/null || true
                
                echo "=== HOÀN THÀNH AUTO-DEPLOY ==="
            `;
        } else {
            // webserver PHP / HTML
            script = `
                set -e
                cd ${escapeShellArg(webhook.appPath)} || { echo "LỖI: Không tìm thấy thư mục ${webhook.appPath}"; exit 1; }
                
                echo "=== [$(date)] BẮT ĐẦU TỰ ĐỘNG DEPLOY WEB SERVER SITE ==="
                echo "1. Đang pull code mới từ Git..."
                git fetch --all
                git reset --hard origin/${escapeShellArg(webhook.gitBranch || 'main')}

                ${webhook.customCommand ? `echo "2. Thực thi lệnh tùy chỉnh..."\n${webhook.customCommand}` : ''}

                echo "3. Khôi phục quyền sở hữu cho Nginx (www-data)..."
                chown -R www-data:www-data ${escapeShellArg(webhook.appPath)}

                echo "=== HOÀN THÀNH AUTO-DEPLOY ==="
            `;
        }

        const result = await ssh.executeCommand(script);
        output = result.stdout + '\n' + result.stderr;
        success = result.code === 0;

        console.log(`[AutoDeploy] Kết quả deploy cho ${webhook.name}: ${success ? 'THÀNH CÔNG' : 'THẤT BẠI'}`);

    } catch (err) {
        success = false;
        output = `Lỗi hệ thống khi deploy: ${err.message}`;
        console.error(`[AutoDeploy] Lỗi deploy cho ${webhook.name}:`, err.message);
    }

    // Cập nhật kết quả vào file json
    try {
        const webhooks = loadWebhooks();
        const idx = webhooks.findIndex(w => w.id === webhook.id);
        if (idx !== -1) {
            const current = webhooks[idx];
            current.lastTriggered = new Date().toISOString();
            current.lastStatus = success ? 'success' : 'error';
            
            if (!current.history) current.history = [];
            current.history.unshift({
                timestamp: new Date().toISOString(),
                status: success ? 'success' : 'error',
                commit: commitInfo,
                output: output.substring(0, 15000) // Cắt bớt logs nếu quá dài để tối ưu kích thước file json
            });

            // Giới hạn tối đa lưu 5 lịch sử deploy gần nhất
            if (current.history.length > 5) {
                current.history = current.history.slice(0, 5);
            }

            saveWebhooks(webhooks);
        }
    } catch (e) {
        console.error('Lỗi khi ghi lịch sử webhook:', e.message);
    }

    // Phát tín hiệu Socket.IO realtime cho giao diện Panel
    try {
        const io = getIo();
        if (io) {
            io.emit('webhook:deployed', {
                webhookId: webhook.id,
                status: success ? 'success' : 'error',
                lastTriggered: new Date().toISOString(),
                headCommit: commitInfo
            });
        }
    } catch (err) {
        console.error('Lỗi khi phát socket.io event:', err.message);
    }
}

module.exports = {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    triggerManual,
    handleDeploy
};
