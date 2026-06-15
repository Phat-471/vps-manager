const { connectionPool } = require('../utils/ssh');

/**
 * Clean version string to prevent shell injection.
 * Allows format like 20, 20.11.0, v20.11.0, lts/iron, --lts, etc.
 */
function cleanNodeVersion(version) {
    if (!version) return '';
    const cleaned = version.trim();
    // Validate against safe pattern
    if (/^[vV]?\d+(\.\d+){0,2}$/.test(cleaned)) {
        return cleaned;
    }
    if (/^lts\/[a-zA-Z-]+$/.test(cleaned)) {
        return cleaned;
    }
    if (cleaned === '--lts') {
        return cleaned;
    }
    return '';
}

async function getNodeStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            # Check if NVM script exists
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                echo "NVM_INSTALLED:true"
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh"
                echo "NVM_VERSION:$(nvm --version 2>/dev/null || echo 'unknown')"
                echo "NODE_VERSION:$(node -v 2>/dev/null || echo 'none')"
                echo "NPM_VERSION:$(npm -v 2>/dev/null || echo 'none')"
            else
                echo "NVM_INSTALLED:false"
            fi

            # Check if PM2 is installed
            if command -v pm2 &>/dev/null; then
                echo "PM2_INSTALLED:true"
                echo "PM2_VERSION:$(pm2 --version 2>/dev/null || echo 'unknown')"
                echo "PM2_STARTUP_ENABLED:$(systemctl is-enabled pm2-pm2user 2>/dev/null || systemctl is-enabled pm2-root 2>/dev/null || echo 'disabled')"
            else
                echo "PM2_INSTALLED:false"
            fi
        `;

        const result = await ssh.executeCommand(script);
        const lines = result.stdout.trim().split('\n');
        const status = {
            nvmInstalled: false,
            nvmVersion: '',
            nodeVersion: '',
            npmVersion: '',
            pm2Installed: false,
            pm2Version: '',
            pm2StartupEnabled: false
        };

        lines.forEach(line => {
            if (line.startsWith('NVM_INSTALLED:')) {
                status.nvmInstalled = line.replace('NVM_INSTALLED:', '').trim() === 'true';
            } else if (line.startsWith('NVM_VERSION:')) {
                status.nvmVersion = line.replace('NVM_VERSION:', '').trim();
            } else if (line.startsWith('NODE_VERSION:')) {
                status.nodeVersion = line.replace('NODE_VERSION:', '').trim();
            } else if (line.startsWith('NPM_VERSION:')) {
                status.npmVersion = line.replace('NPM_VERSION:', '').trim();
            } else if (line.startsWith('PM2_INSTALLED:')) {
                status.pm2Installed = line.replace('PM2_INSTALLED:', '').trim() === 'true';
            } else if (line.startsWith('PM2_VERSION:')) {
                status.pm2Version = line.replace('PM2_VERSION:', '').trim();
            } else if (line.startsWith('PM2_STARTUP_ENABLED:')) {
                const val = line.replace('PM2_STARTUP_ENABLED:', '').trim();
                status.pm2StartupEnabled = val === 'enabled';
            }
        });

        res.json({
            success: true,
            data: status
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installNVM(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            # Install prerequisites
            if [ -f /etc/debian_version ]; then
                apt-get update && apt-get install -y curl build-essential
            else
                yum install -y curl wget
            fi

            # Install NVM
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
            
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
            
            if [ -s "$NVM_DIR/nvm.sh" ]; then
                echo "SUCCESS"
            else
                echo "ERROR"
            fi
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0 || result.stdout.includes('ERROR')) {
            return res.status(500).json({ success: false, error: 'Không thể cài đặt NVM.', details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: 'Đã cài đặt NVM thành công! Vui lòng tải lại hoặc thiết lập phiên bản Node.js.' });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listNodeVersions(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

            echo "===CURRENT==="
            node -v 2>/dev/null || echo "none"

            echo "===DEFAULT==="
            nvm version default 2>/dev/null || echo "none"

            echo "===INSTALLED==="
            if [ -d "$NVM_DIR/versions/node" ]; then
                ls -1 "$NVM_DIR/versions/node"
            fi

            echo "===REMOTE_LTS==="
            if command -v timeout >/dev/null; then
                timeout 8 nvm ls-remote --lts --no-colors 2>/dev/null | tail -n 25 || echo "timeout"
            else
                nvm ls-remote --lts --no-colors 2>/dev/null | tail -n 25 || echo "failed"
            fi
        `;

        const result = await ssh.executeCommand(script);
        const lines = result.stdout.trim().split('\n');
        
        let section = '';
        let current = '';
        let defaultVer = '';
        const installed = [];
        const remoteLts = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed === '===CURRENT===') {
                section = 'current';
                return;
            }
            if (trimmed === '===DEFAULT===') {
                section = 'default';
                return;
            }
            if (trimmed === '===INSTALLED===') {
                section = 'installed';
                return;
            }
            if (trimmed === '===REMOTE_LTS===') {
                section = 'remote';
                return;
            }

            if (section === 'current') {
                current = trimmed;
            } else if (section === 'default') {
                defaultVer = trimmed;
            } else if (section === 'installed') {
                installed.push(trimmed);
            } else if (section === 'remote') {
                // Line formats like: "v20.11.1   (LTS: Iron)"
                const match = trimmed.match(/^(v\d+\.\d+\.\d+)\s*(\(LTS:\s*([a-zA-Z]+)\))?/);
                if (match) {
                    remoteLts.push({
                        version: match[1],
                        ltsLabel: match[3] || ''
                    });
                }
            }
        });

        if (remoteLts.length === 0) {
            remoteLts.push(
                { version: 'v22.11.0', ltsLabel: 'Jod' },
                { version: 'v20.18.0', ltsLabel: 'Iron' },
                { version: 'v18.20.4', ltsLabel: 'Hydrogen' },
                { version: 'v16.20.2', ltsLabel: 'Gallium' },
                { version: 'v14.21.3', ltsLabel: 'Fermium' }
            );
        }

        // Group into unique list of versions
        const resultData = {
            current,
            default: defaultVer,
            installed: installed.map(v => ({ version: v, installed: true })),
            remoteLts
        };

        res.json({
            success: true,
            data: resultData
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installNodeVersion(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const cleanVer = cleanNodeVersion(version);

        if (!cleanVer) {
            return res.status(400).json({ success: false, error: 'Phiên bản Node.js không hợp lệ hoặc không an toàn' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
            nvm install ${cleanVer}
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: `Cài đặt Node.js ${cleanVer} thất bại`, details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: `Đã cài đặt thành công Node.js ${cleanVer}!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function setDefaultNodeVersion(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const cleanVer = cleanNodeVersion(version);

        if (!cleanVer) {
            return res.status(400).json({ success: false, error: 'Phiên bản Node.js không hợp lệ hoặc không an toàn' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
            
            nvm alias default ${cleanVer}
            nvm use default
            
            NODE_PATH=$(which node)
            NPM_PATH=$(which npm)
            
            if [ -n "$NODE_PATH" ] && [ -f "$NODE_PATH" ]; then
                rm -f /usr/bin/node /usr/bin/npm /usr/bin/npx
                ln -s "$NODE_PATH" /usr/bin/node
                ln -s "$NPM_PATH" /usr/bin/npm
                
                NPX_PATH=$(which npx)
                if [ -n "$NPX_PATH" ] && [ -f "$NPX_PATH" ]; then
                    ln -s "$NPX_PATH" /usr/bin/npx
                fi
                echo "SUCCESS"
            else
                echo "ERROR_PATH"
                exit 1
            fi
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0 || result.stdout.includes('ERROR_PATH')) {
            return res.status(500).json({ success: false, error: `Đặt phiên bản mặc định thất bại`, details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: `Đã đặt Node.js ${cleanVer} làm mặc định hệ thống và tạo symlinks thành công!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function uninstallNodeVersion(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const cleanVer = cleanNodeVersion(version);

        if (!cleanVer) {
            return res.status(400).json({ success: false, error: 'Phiên bản Node.js không hợp lệ hoặc không an toàn' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
            nvm uninstall ${cleanVer}
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: `Gỡ cài đặt Node.js ${cleanVer} thất bại`, details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: `Đã gỡ cài đặt Node.js ${cleanVer} thành công!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function setupPM2Startup(req, res) {
    try {
        const { vpsConfig, action } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        let script = '';
        if (action === 'enable') {
            script = `
                # Cấu hình PM2 startup cho pm2user và root
                if id -u pm2user &>/dev/null; then
                    pm2 startup systemd -u pm2user --hp /home/pm2user || true
                    sudo -u pm2user pm2 save --force || true
                else
                    pm2 startup systemd || true
                    pm2 save --force || true
                fi
                systemctl daemon-reload
                
                # Enable và Start service
                SERVICE_NAME=$(systemctl list-unit-files | grep pm2- | awk '{print $1}' | head -1)
                if [ -n "$SERVICE_NAME" ]; then
                    systemctl enable $SERVICE_NAME
                    systemctl start $SERVICE_NAME
                    echo "SUCCESS:$SERVICE_NAME"
                else
                    echo "ERROR_NO_SERVICE"
                fi
            `;
        } else {
            script = `
                # Disable và Stop service
                SERVICE_NAME=$(systemctl list-unit-files | grep pm2- | awk '{print $1}' | head -1)
                if [ -n "$SERVICE_NAME" ]; then
                    systemctl disable $SERVICE_NAME
                    systemctl stop $SERVICE_NAME
                    rm -f /etc/systemd/system/$SERVICE_NAME
                    echo "SUCCESS_DISABLED"
                else
                    pm2 unstartup 2>/dev/null || true
                    echo "NO_SERVICE"
                fi
                systemctl daemon-reload
            `;
        }

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Thao tác PM2 Startup thất bại', details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: action === 'enable' ? 'Đã kích hoạt PM2 tự khởi chạy cùng hệ thống thành công!' : 'Đã hủy PM2 tự khởi chạy thành công!',
            output: result.stdout.trim()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getNodeStatus,
    installNVM,
    listNodeVersions,
    installNodeVersion,
    setDefaultNodeVersion,
    uninstallNodeVersion,
    setupPM2Startup
};
