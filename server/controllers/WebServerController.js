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
        const { vpsConfig, domain, root, type, proxyPort, antiDdos = false, blockBots = false } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        const safeRoot = escapeShellArg(root);
        const safePort = sanitizeNumber(proxyPort);

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        let securityDirectives = '';
        if (antiDdos) {
            // Đảm bảo limit_req_zone toàn cục tồn tại trên VPS
            await ssh.executeCommand(`
                if [ ! -f /etc/nginx/conf.d/ddos_limit.conf ]; then
                    echo "limit_req_zone \\$binary_remote_addr zone=ddos_limit:10m rate=10r/s;" > /etc/nginx/conf.d/ddos_limit.conf
                fi
            `);
            securityDirectives += '\n    limit_req zone=ddos_limit burst=20 nodelay;';
        }
        
        if (blockBots) {
            securityDirectives += `
    if ($http_user_agent ~* (SemrushBot|AhrefsBot|MJ12bot|DotBot|Baiduspider|python-requests|curl|wget)) {
        return 403;
    }`;
        }

        let config = '';
        if (type === 'php') {
            config = `
server {
    listen 80;
    server_name ${safeDomain};
    root ${root};
    index index.php index.html;
    ${securityDirectives}

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
    ${securityDirectives}

    location / {
        proxy_pass http://localhost:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;
        } else {
            config = `
server {
    listen 80;
    server_name ${safeDomain};
    root ${root};
    index index.html;
    ${securityDirectives}

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
        
        // Ghi cấu hình hosts an toàn qua SFTP thay vì command injection nguy hiểm
        await ssh.writeFile('/etc/hosts', content);
        
        res.json({ success: true, message: 'Đã lưu cấu hình file Hosts thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listSSLCertificates(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('certbot certificates 2>/dev/null || echo "NO_CERTBOT"');
        if (result.stdout.includes('NO_CERTBOT') || result.stdout.trim() === '') {
            return res.json({ success: true, data: [] });
        }

        const certificates = [];
        const lines = result.stdout.split('\n');
        let currentCert = null;

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('Certificate Name:')) {
                if (currentCert) {
                    certificates.push(currentCert);
                }
                currentCert = {
                    name: line.replace('Certificate Name:', '').trim(),
                    domains: [],
                    expiryDate: '',
                    daysRemaining: 0,
                    valid: false
                };
            } else if (currentCert && line.startsWith('Domains:')) {
                currentCert.domains = line.replace('Domains:', '').trim().split(/\s+/);
            } else if (currentCert && line.startsWith('Expiry Date:')) {
                const expiryPart = line.replace('Expiry Date:', '').trim();
                currentCert.expiryDate = expiryPart.split('(')[0].trim();
                currentCert.valid = expiryPart.includes('(valid)');

                const daysMatch = expiryPart.match(/(\d+)\s+days/);
                if (daysMatch) {
                    currentCert.daysRemaining = parseInt(daysMatch[1]);
                } else {
                    const dateStr = currentCert.expiryDate.split(' ')[0];
                    const expiry = new Date(dateStr);
                    const now = new Date();
                    const diffTime = expiry - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    currentCert.daysRemaining = isNaN(diffDays) ? 0 : diffDays;
                }
            }
        }

        if (currentCert) {
            certificates.push(currentCert);
        }

        res.json({ success: true, data: certificates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function renewAllSSL(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('certbot renew --post-hook "systemctl reload nginx"');
        res.json({ success: true, data: result.stdout || result.stderr });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function setupSSLAutoRenewCron(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const cronCommand = "echo \"0 0 * * * root certbot renew --post-hook 'systemctl reload nginx' >/dev/null 2>&1\" > /etc/cron.d/certbot-renew-panel";
        const result = await ssh.executeCommand(cronCommand);

        if (result.code !== 0) {
            throw new Error(result.stderr || 'Không thể tạo file cron job');
        }

        res.json({ success: true, message: 'Đã thiết lập Cron Job tự động gia hạn SSL Let\'s Encrypt thành công!' });
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
    saveHosts,
    listSSLCertificates,
    renewAllSSL,
    setupSSLAutoRenewCron
};
