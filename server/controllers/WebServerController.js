const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg, sanitizeNumber } = require('../utils/security');
const { logActivity } = require('../utils/logger');

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
        const { vpsConfig, domain, root, type, proxyPort, phpVersion, antiDdos = false, blockBots = false } = req.body;
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
            // Find actual FPM socket dynamically
            let fpmSock = `/run/php/php${phpVersion || ''}-fpm.sock`;
            const checkSock = await ssh.executeCommand(`[ -S "${fpmSock}" ] && echo "OK" || echo "NO"`);
            if (checkSock.stdout.trim() !== 'OK') {
                const findSock = await ssh.executeCommand('find /run/php/ -name "php*-fpm.sock" | head -1');
                if (findSock.code === 0 && findSock.stdout.trim()) {
                    fpmSock = findSock.stdout.trim();
                } else {
                    const findSockVar = await ssh.executeCommand('find /var/run/php/ -name "php*-fpm.sock" | head -1');
                    if (findSockVar.code === 0 && findSockVar.stdout.trim()) {
                        fpmSock = findSockVar.stdout.trim();
                    } else {
                        fpmSock = '/var/run/php/php-fpm.sock'; // Fallback
                    }
                }
            }

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
        fastcgi_pass unix:${fpmSock};
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

        logActivity('Tạo Website', `Đã thêm website ${domain} (loại: ${type})`, vpsConfig.id);
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

        logActivity('Xóa Website', `Đã xóa website ${domain}`, vpsConfig.id);
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
        logActivity('Sửa cấu hình Nginx', `Đã cập nhật tệp tin cấu hình Nginx cho ${domain}`, vpsConfig.id);
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
        logActivity('Bật/Tắt Website', `Đã ${enable ? 'bật' : 'tắt'} website ${domain}`, vpsConfig.id);
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

        // Kiểm tra xem certbot và plugin nginx đã cài chưa
        const checkCertbot = await ssh.executeCommand('dpkg -l | grep -q python3-certbot-nginx && echo "OK" || echo "NO"');
        if (checkCertbot.stdout.trim() !== 'OK') {
            await ssh.executeCommand('apt-get update && apt-get install -y certbot python3-certbot-nginx');
        }

        const safeEmail = escapeShellArg(email || 'admin@' + safeDomain);
        const result = await ssh.executeCommand(`certbot --nginx -d ${safeDomain} --non-interactive --agree-tos -m ${safeEmail}`);

        logActivity('Cài đặt SSL', `Cài đặt chứng chỉ SSL Let's Encrypt cho ${domain}`, vpsConfig.id);
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

async function checkSSLAutoRenewStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const checkCmd = "test -f /etc/cron.d/certbot-renew-panel && echo 'EXISTS' || echo 'NOT_EXISTS'";
        const result = await ssh.executeCommand(checkCmd);
        const active = result.stdout.trim() === 'EXISTS';

        res.json({
            success: true,
            active,
            schedule: '0 0 * * *',
            command: "certbot renew --post-hook 'systemctl reload nginx'"
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function testSSLAutoRenew(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('certbot renew --dry-run');
        res.json({
            success: true,
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function updateNginxConfigForSSL(ssh, domain, certPath, keyPath) {
    const configPath = `/etc/nginx/sites-available/${domain}`;
    const exists = await ssh.exists(configPath);
    if (!exists) {
        throw new Error(`Cấu hình Nginx cho tên miền ${domain} không tồn tại.`);
    }

    const configContent = await ssh.readFile(configPath);

    let newConfig = configContent;
    if (configContent.includes('listen 443 ssl')) {
        // Cập nhật đường dẫn cert cũ
        newConfig = configContent.replace(/ssl_certificate\s+[^;]+;/g, `ssl_certificate ${certPath};`);
        newConfig = newConfig.replace(/ssl_certificate_key\s+[^;]+;/g, `ssl_certificate_key ${keyPath};`);
    } else {
        // Chuyển http thành https
        const redirectBlock = `server {
    listen 80;
    server_name ${domain} *.${domain};
    return 301 https://$host$request_uri;
}

`;
        let updatedBlock = configContent.replace(/listen\s+80\s*;/g, `listen 443 ssl;
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;`);

        newConfig = redirectBlock + updatedBlock;
    }

    await ssh.writeFile(configPath, newConfig);
    const testResult = await ssh.executeCommand('nginx -t');
    if (testResult.code !== 0) {
        // Phục hồi lại cấu hình cũ nếu lỗi
        await ssh.writeFile(configPath, configContent);
        throw new Error(`Cấu hình Nginx lỗi: ${testResult.stderr}`);
    }

    await ssh.executeCommand('systemctl reload nginx');
}

async function installWildcardSSL(req, res) {
    try {
        const { vpsConfig, domain, email, cfEmail, cfKey, cfToken } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Cài đặt certbot plugin cloudflare dns
        await ssh.executeCommand('apt-get update && apt-get install -y certbot python3-certbot-dns-cloudflare');

        const secretsDir = '/root/.secrets/certbot';
        await ssh.executeCommand(`mkdir -p ${secretsDir}`);
        
        let iniContent = '';
        if (cfToken) {
            iniContent = `dns_cloudflare_api_token = ${cfToken.trim()}\n`;
        } else {
            iniContent = `dns_cloudflare_email = ${cfEmail.trim()}\ndns_cloudflare_api_key = ${cfKey.trim()}\n`;
        }

        const iniPath = `${secretsDir}/cloudflare.ini`;
        await ssh.writeFile(iniPath, iniContent);
        await ssh.executeCommand(`chmod 600 ${iniPath}`);

        const safeEmail = escapeShellArg(email || `admin@${safeDomain}`);
        const certbotCmd = `certbot certonly --dns-cloudflare --dns-cloudflare-credentials ${iniPath} -d "*.${safeDomain}" -d "${safeDomain}" --non-interactive --agree-tos -m ${safeEmail} --dns-cloudflare-propagation-seconds 10`;

        const result = await ssh.executeCommand(certbotCmd);
        if (result.code !== 0) {
            throw new Error(`Certbot wildcard error: ${result.stdout}\n${result.stderr}`);
        }

        const certPath = `/etc/letsencrypt/live/${safeDomain}/fullchain.pem`;
        const keyPath = `/etc/letsencrypt/live/${safeDomain}/privkey.pem`;
        
        await updateNginxConfigForSSL(ssh, safeDomain, certPath, keyPath);

        res.json({
            success: true,
            message: `Cài đặt SSL Wildcard thành công cho ${safeDomain}`,
            log: result.stdout
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function uploadCustomSSL(req, res) {
    try {
        const { vpsConfig, domain, certText, keyText } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }
        if (!certText || !keyText) {
            return res.status(400).json({ success: false, error: 'Thiếu nội dung Certificate hoặc Private Key' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const sslDir = '/etc/nginx/ssl';
        await ssh.executeCommand(`mkdir -p ${sslDir}`);

        const certPath = `${sslDir}/${safeDomain}.crt`;
        const keyPath = `${sslDir}/${safeDomain}.key`;

        await ssh.writeFile(certPath, certText.trim());
        await ssh.writeFile(keyPath, keyText.trim());
        await ssh.executeCommand(`chmod 600 ${keyPath}`);

        await updateNginxConfigForSSL(ssh, safeDomain, certPath, keyPath);

        res.json({
            success: true,
            message: `Cài đặt Custom SSL thành công cho ${safeDomain}`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Phase 4: Nginx Config Error Scanner
 * Runs `nginx -t` on the remote VPS and parses the structured error output
 */
async function scanNginxConfig(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Run nginx -t and capture both stdout + stderr
        const testResult = await ssh.executeCommand('nginx -t 2>&1; echo "NGINX_TEST_EXIT:$?"');
        const raw = testResult.stdout + testResult.stderr;

        // Also gather list of all config files
        const filesResult = await ssh.executeCommand(
            'find /etc/nginx -name "*.conf" -not -path "*/snippets/*" 2>/dev/null | sort; ' +
            'ls /etc/nginx/sites-enabled/ 2>/dev/null | sed "s|^|/etc/nginx/sites-enabled/|"'
        );
        const allFiles = filesResult.stdout.trim().split('\n').filter(Boolean);

        // Check if nginx test passed
        const exitMatch = raw.match(/NGINX_TEST_EXIT:(\d+)/);
        const exitCode = exitMatch ? parseInt(exitMatch[1]) : 1;
        const passed = exitCode === 0;

        // Parse error lines: "nginx: [emerg] message in /path/to/file.conf:42"
        const errors = [];
        const lines = raw.split('\n');
        for (const line of lines) {
            if (!line.includes('[emerg]') && !line.includes('[warn]') && !line.includes('[crit]')) continue;
            const severity = line.includes('[emerg]') || line.includes('[crit]') ? 'error' : 'warning';
            // Extract file:line pattern
            const fileMatch = line.match(/in\s+(\/[^:]+):(\d+)/);
            const msgMatch = line.match(/\[(emerg|warn|crit)\]\s+(.+?)(?:\s+in\s+\/|$)/);
            errors.push({
                severity,
                message: msgMatch ? msgMatch[2].trim() : line.trim(),
                file: fileMatch ? fileMatch[1] : null,
                line: fileMatch ? parseInt(fileMatch[2]) : null,
                raw: line.trim()
            });
        }

        // For each error file, read nearby context lines
        const errorDetails = [];
        const readFiles = new Set(errors.filter(e => e.file).map(e => e.file));
        for (const filePath of readFiles) {
            const safeFile = filePath.replace(/[^a-zA-Z0-9/_.\-]/g, '');
            const contentResult = await ssh.executeCommand(`cat -n ${safeFile} 2>/dev/null || echo "FILE_NOT_READABLE"`);
            if (!contentResult.stdout.includes('FILE_NOT_READABLE')) {
                errorDetails.push({ file: safeFile, content: contentResult.stdout });
            }
        }

        res.json({
            success: true,
            data: {
                passed,
                errors,
                errorDetails,
                allFiles,
                rawOutput: raw.replace(/NGINX_TEST_EXIT:\d+\n?/, '').trim()
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Phase 4: Auto-fix common Nginx config issues
 * Supports: missing semicolons, wrong PHP socket path
 */
async function fixNginxIssue(req, res) {
    try {
        const { vpsConfig, fixType, filePath, lineNumber } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const safeFile = (filePath || '').replace(/[^a-zA-Z0-9/_.\-]/g, '');
        if (!safeFile) {
            return res.status(400).json({ success: false, error: 'Đường dẫn file không hợp lệ' });
        }

        let fixScript = '';

        if (fixType === 'backup_and_reload') {
            // Simply backup + test + reload
            fixScript = `
                cp ${safeFile} ${safeFile}.bak.$(date +%s)
                nginx -t 2>&1 && systemctl reload nginx
                echo "DONE"
            `;
        } else if (fixType === 'add_semicolon') {
            // Add missing semicolons at end of directives on problematic line
            const safeLine = parseInt(lineNumber) || 1;
            fixScript = `
                cp ${safeFile} ${safeFile}.bak.$(date +%s)
                sed -i '${safeLine}s/\\([^;{]\\)$/\\1;/' ${safeFile}
                nginx -t 2>&1 && echo "RELOAD_OK" || echo "FIX_FAILED"
            `;
        } else if (fixType === 'fix_php_socket') {
            // Detect actual PHP-FPM socket path and update config
            fixScript = `
                # Find actual php-fpm socket
                SOCKET=$(find /run/php/ -name "php*-fpm.sock" 2>/dev/null | head -1)
                if [ -z "$SOCKET" ]; then
                    SOCKET=$(find /var/run/php/ -name "php*-fpm.sock" 2>/dev/null | head -1)
                fi
                if [ -z "$SOCKET" ]; then
                    echo "SOCKET_NOT_FOUND"
                    exit 1
                fi
                cp ${safeFile} ${safeFile}.bak.$(date +%s)
                # Replace any fastcgi_pass unix:/run/php/... path
                sed -i "s|fastcgi_pass unix:/[^;]*;|fastcgi_pass unix:$SOCKET;|g" ${safeFile}
                nginx -t 2>&1 && echo "RELOAD_OK" || echo "FIX_FAILED"
            `;
        } else if (fixType === 'remove_duplicate_default') {
            // Remove duplicate default_server markers
            fixScript = `
                cp ${safeFile} ${safeFile}.bak.$(date +%s)
                # Remove extra 'default_server' occurrences leaving only first
                awk '/default_server/ && found++ > 0 {sub(/ default_server/, "")} 1' ${safeFile} > /tmp/nginx_fix_tmp && mv /tmp/nginx_fix_tmp ${safeFile}
                nginx -t 2>&1 && echo "RELOAD_OK" || echo "FIX_FAILED"
            `;
        } else if (fixType === 'reload_only') {
            fixScript = `nginx -t 2>&1 && systemctl reload nginx && echo "RELOAD_OK" || echo "RELOAD_FAILED"`;
        } else {
            return res.status(400).json({ success: false, error: 'Loại fix không được hỗ trợ' });
        }

        const result = await ssh.executeCommand(fixScript);
        const output = (result.stdout + result.stderr).trim();
        const success = output.includes('RELOAD_OK') || (fixType === 'reload_only' && !output.includes('RELOAD_FAILED'));

        res.json({
            success: true,
            data: {
                applied: success,
                output
            }
        });
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
    setupSSLAutoRenewCron,
    checkSSLAutoRenewStatus,
    testSSLAutoRenew,
    installWildcardSSL,
    uploadCustomSSL,
    scanNginxConfig,
    fixNginxIssue
};
