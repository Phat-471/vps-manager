const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg, sanitizeNumber } = require('../utils/security');

async function listSites(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // List files in sites-enabled to see active sites
        const result = await ssh.executeCommand('ls -1 /etc/nginx/sites-enabled');
        const siteFiles = result.stdout.trim().split('\n').filter(f => f && f !== 'default');

        const sites = [];
        for (const file of siteFiles) {
            const safeFile = sanitizeAlphaNum(file);
            if (!safeFile) continue;
            // Read config to get root and type
            const config = await ssh.executeCommand(`cat /etc/nginx/sites-enabled/${safeFile}`);
            const content = config.stdout;

            let type = 'static';
            if (content.includes('fastcgi_pass')) type = 'php';
            if (content.includes('proxy_pass')) type = 'proxy';

            const rootMatch = content.match(/root\s+([^;]+);/);
            const root = rootMatch ? rootMatch[1].trim() : 'N/A';

            sites.push({
                domain: file,
                root: root,
                type: type,
                enabled: true
            });
        }

        res.json({
            success: true,
            data: sites
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function addSite(req, res) {
    try {
        const { vpsConfig, domain, root, type, proxyPort } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const safeRoot = escapeShellArg(root);
        const safePort = sanitizeNumber(proxyPort);

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        let config = '';
        if (type === 'php') {
            config = `
server {
    listen 80;
    server_name ${safeDomain};
    root ${root};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
    }
}`;
        } else if (type === 'proxy') {
            config = `
server {
    listen 80;
    server_name ${safeDomain};

    location / {
        proxy_pass http://localhost:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
        } else {
            config = `
server {
    listen 80;
    server_name ${safeDomain};
    root ${root};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;
        }

        // Create directory
        await ssh.executeCommand(`mkdir -p ${safeRoot}`);
        await ssh.executeCommand(`chown -R www-data:www-data ${safeRoot}`);

        // Write config
        await ssh.executeCommand(`cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
${config}
EOF`);

        // Enable site
        await ssh.executeCommand(`ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/`);

        // Test and reload nginx
        await ssh.executeCommand('nginx -t && systemctl reload nginx');

        res.json({
            success: true,
            message: 'Đã thêm website thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function deleteSite(req, res) {
    try {
        const { vpsConfig, domain } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.executeCommand(`rm -f /etc/nginx/sites-enabled/${safeDomain}`);
        await ssh.executeCommand(`rm -f /etc/nginx/sites-available/${safeDomain}`);
        await ssh.executeCommand('systemctl reload nginx');

        res.json({
            success: true,
            message: 'Đã xóa website thành công'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function getSiteConfig(req, res) {
    try {
        const { vpsConfig, domain } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`cat /etc/nginx/sites-available/${safeDomain}`);
        res.json({ success: true, data: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveSiteConfig(req, res) {
    try {
        const { vpsConfig, domain, config } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.executeCommand(`cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
${config}
EOF`);

        const test = await ssh.executeCommand('nginx -t');
        if (test.stderr && test.stderr.includes('emerg')) {
            throw new Error('Nginx Config Error: ' + test.stderr);
        }

        await ssh.executeCommand('systemctl reload nginx');
        res.json({ success: true, message: 'Config saved and Nginx reloaded' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function toggleSite(req, res) {
    try {
        const { vpsConfig, domain, enable } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        if (enable) {
            await ssh.executeCommand(`ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/`);
        } else {
            await ssh.executeCommand(`rm -f /etc/nginx/sites-enabled/${safeDomain}`);
        }

        await ssh.executeCommand('systemctl reload nginx');
        res.json({ success: true, message: enable ? 'Site enabled' : 'Site disabled' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installSSL(req, res) {
    try {
        const { vpsConfig, domain, email } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const safeEmail = escapeShellArg(email || 'admin@' + safeDomain);
        const result = await ssh.executeCommand(`certbot --nginx -d ${safeDomain} --non-interactive --agree-tos -m ${safeEmail}`);

        res.json({ success: true, data: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getNginxStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const status = await ssh.executeCommand('systemctl is-active nginx');
        const version = await ssh.executeCommand('nginx -v');

        res.json({
            success: true,
            data: {
                active: status.stdout.trim() === 'active',
                version: version.stderr.trim()
            }
        });
    } catch (err) {
        res.json({ success: true, data: { active: false, version: 'N/A' } });
    }
}

async function checkDNS(req, res) {
    try {
        const { vpsConfig, domain } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        // Chạy lệnh tra cứu DNS trên VPS
        const aRecord = await ssh.executeCommand(`host -t A ${safeDomain} | grep "has address" | awk '{print $NF}' || echo "N/A"`);
        const nsRecord = await ssh.executeCommand(`host -t NS ${safeDomain} | grep "name server" | awk '{print $NF}' || echo "N/A"`);
        const mxRecord = await ssh.executeCommand(`host -t MX ${safeDomain} | grep "mail is handled by" | awk '{print $NF}' || echo "N/A"`);
        
        const aIp = aRecord.stdout.trim().split('\n').filter(x => x && x !== 'N/A' && !x.includes('not found'));
        const nsServers = nsRecord.stdout.trim().split('\n').filter(x => x && x !== 'N/A' && !x.includes('not found')).map(s => s.replace(/\.$/, ''));
        const mxServers = mxRecord.stdout.trim().split('\n').filter(x => x && x !== 'N/A' && !x.includes('not found')).map(s => s.replace(/\.$/, ''));
        
        res.json({
            success: true,
            data: {
                domain: safeDomain,
                ip: aIp.length > 0 ? aIp : ['Chưa trỏ IP'],
                ns: nsServers.length > 0 ? nsServers : ['N/A'],
                mx: mxServers.length > 0 ? mxServers : ['N/A']
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getHosts(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand('cat /etc/hosts');
        res.json({ success: true, data: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveHosts(req, res) {
    try {
        const { vpsConfig, content } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        // Write content safely back to /etc/hosts
        await ssh.executeCommand(`cat > /etc/hosts << 'EOF'
${content}
EOF`);
        
        res.json({ success: true, message: 'Đã lưu cấu hình file Hosts thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listSites,
    addSite,
    deleteSite,
    getSiteConfig,
    saveSiteConfig,
    toggleSite,
    installSSL,
    getNginxStatus,
    checkDNS,
    getHosts,
    saveHosts
};
