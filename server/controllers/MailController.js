const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, sanitizeNumber, escapeShellArg } = require('../utils/security');

// Helper to sanitize usernames (allowing alphanumeric and dot, hyphen, underscore)
function sanitizeEmailUsername(username) {
    if (!username) return '';
    return username.trim().replace(/[^a-zA-Z0-9._-]/g, '');
}

async function getMailStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            # Check postfix
            if command -v postfix >/dev/null && systemctl is-active postfix >/dev/null 2>&1; then
                POSTFIX_ACTIVE="active"
            elif command -v postfix >/dev/null; then
                POSTFIX_ACTIVE="inactive"
            else
                POSTFIX_ACTIVE="not-installed"
            fi

            # Check dovecot
            if command -v dovecot >/dev/null && systemctl is-active dovecot >/dev/null 2>&1; then
                DOVECOT_ACTIVE="active"
            elif command -v dovecot >/dev/null; then
                DOVECOT_ACTIVE="inactive"
            else
                DOVECOT_ACTIVE="not-installed"
            fi
            
            # Check main configuration domain
            MAIN_DOMAIN=""
            if [ -f /etc/postfix/main.cf ]; then
                MAIN_DOMAIN=$(grep -E "^mydomain\s*=" /etc/postfix/main.cf | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo "")
            fi

            echo "POSTFIX:$POSTFIX_ACTIVE"
            echo "DOVECOT:$DOVECOT_ACTIVE"
            echo "DOMAIN:$MAIN_DOMAIN"
        `;

        const result = await ssh.executeCommand(script);
        const lines = result.stdout.trim().split('\n');
        
        let postfixStatus = 'not-installed';
        let dovecotStatus = 'not-installed';
        let configuredDomain = '';

        lines.forEach(line => {
            if (line.startsWith('POSTFIX:')) {
                postfixStatus = line.replace('POSTFIX:', '').trim();
            } else if (line.startsWith('DOVECOT:')) {
                dovecotStatus = line.replace('DOVECOT:', '').trim();
            } else if (line.startsWith('DOMAIN:')) {
                configuredDomain = line.replace('DOMAIN:', '').trim();
            }
        });

        res.json({
            success: true,
            data: {
                installed: postfixStatus !== 'not-installed' && dovecotStatus !== 'not-installed',
                postfixStatus,
                dovecotStatus,
                configuredDomain
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installMailServer(req, res) {
    try {
        const { vpsConfig, domain, email } = req.body;
        const cleanDomain = sanitizeAlphaNum(domain);
        const cleanEmail = email ? email.trim() : `admin@${cleanDomain}`;

        if (!cleanDomain) {
            return res.status(400).json({ success: false, error: 'Tên miền không hợp lệ.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            DOMAIN="${cleanDomain}"
            EMAIL=${escapeShellArg(cleanEmail)}

            # Detect OS
            if [ -f /etc/debian_version ]; then
                OS="debian"
            else
                OS="centos"
            fi

            echo "Installing Mail Server on $OS for domain $DOMAIN..."

            if [ "$OS" == "debian" ]; then
                apt-get update
                
                # Pre-configure postfix non-interactive
                debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"
                debconf-set-selections <<< "postfix postfix/mailname string '$DOMAIN'"
                
                DEBIAN_FRONTEND=noninteractive apt-get install -y postfix dovecot-imapd dovecot-pop3d opendkim opendkim-tools
            else
                yum install -y epel-release
                yum install -y postfix dovecot opendkim opendkim-tools
            fi

            # Configure Postfix
            cp /etc/postfix/main.cf /etc/postfix/main.cf.bak 2>/dev/null || true
            cat << EOF > /etc/postfix/main.cf
# Postfix main.cf configured by VPS Manager
myhostname = mail.$DOMAIN
mydomain = $DOMAIN
myorigin = \\$mydomain
inet_interfaces = all
inet_protocols = all
mydestination = \\$myhostname, localhost.\\$mydomain, localhost, \\$mydomain
home_mailbox = Maildir/

# SMTP SASL Auth (Dovecot)
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination
smtpd_sasl_security_options = noanonymous

# Milter settings (OpenDKIM)
milter_default_action = accept
milter_protocol = 6
smtpd_milters = local:/run/opendkim/opendkim.sock
non_smtpd_milters = local:/run/opendkim/opendkim.sock
EOF

            # Configure Dovecot Mailbox Location
            sed -i 's|^#\\?mail_location =.*|mail_location = maildir:~/Maildir|g' /etc/dovecot/conf.d/10-mail.conf

            # Configure Dovecot Auth Listener for Postfix
            cat << 'EOF' > /etc/dovecot/conf.d/99-vps-manager-auth.conf
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
EOF

            # Enable plaintext authentication
            sed -i 's|^#\\?disable_plaintext_auth =.*|disable_plaintext_auth = no|g' /etc/dovecot/conf.d/10-auth.conf
            sed -i 's|^auth_mechanisms =.*|auth_mechanisms = plain login|g' /etc/dovecot/conf.d/10-auth.conf

            # Configure OpenDKIM
            mkdir -p /etc/opendkim
            cat << EOF > /etc/opendkim.conf
# OpenDKIM configuration by VPS Manager
Syslog                  yes
RequiredHeaders         yes
UMask                   007
Domain                  $DOMAIN
KeyFile                 /etc/opendkim/keys/$DOMAIN/default.private
Selector                default
Socket                  local:/run/opendkim/opendkim.sock
PidFile                 /run/opendkim/opendkim.pid
OversignHeaders         From
EOF

            # Add postfix to opendkim group
            usermod -a -G opendkim postfix 2>/dev/null || true

            # Generate DKIM keys
            mkdir -p /etc/opendkim/keys/"$DOMAIN"
            if [ ! -f "/etc/opendkim/keys/$DOMAIN/default.private" ]; then
                opendkim-genkey -b 2048 -d "$DOMAIN" -s default -D /etc/opendkim/keys/"$DOMAIN"
                chown -R opendkim:opendkim /etc/opendkim 2>/dev/null || true
                chmod -R 700 /etc/opendkim/keys 2>/dev/null || true
            fi

            # Initialize mail registry file
            touch /etc/vps-manager-mailboxes.txt

            # Restart services
            systemctl enable postfix dovecot opendkim 2>/dev/null || true
            systemctl restart postfix dovecot opendkim 2>/dev/null || true
            echo "SUCCESS"
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0 || !result.stdout.includes('SUCCESS')) {
            return res.status(500).json({ success: false, error: 'Cài đặt Mail Server thất bại.', details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: `Đã cài đặt và cấu hình Mail Server thành công cho tên miền ${cleanDomain}!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getDNSInstructions(req, res) {
    try {
        const { vpsConfig, domain } = req.body;
        const cleanDomain = sanitizeAlphaNum(domain);

        if (!cleanDomain) {
            return res.status(400).json({ success: false, error: 'Thiếu hoặc sai tên miền.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            DOMAIN="${cleanDomain}"
            IP_VPS=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
            echo "IP:$IP_VPS"
            
            if [ -f "/etc/opendkim/keys/$DOMAIN/default.txt" ]; then
                # Parse public key out of default.txt
                DKIM_VAL=$(cat "/etc/opendkim/keys/$DOMAIN/default.txt" | tr -d '\\n\\r\\t' | sed -n 's/.*(\\(.*\\)).*/\\1/p' | tr -d '" ')
                echo "DKIM_KEY:$DKIM_VAL"
            else
                echo "DKIM_KEY:none"
            fi
        `;

        const result = await ssh.executeCommand(script);
        const lines = result.stdout.trim().split('\n');

        let ip = 'N/A';
        let dkimKey = 'none';

        lines.forEach(line => {
            if (line.startsWith('IP:')) {
                ip = line.replace('IP:', '').trim();
            } else if (line.startsWith('DKIM_KEY:')) {
                dkimKey = line.replace('DKIM_KEY:', '').trim();
            }
        });

        res.json({
            success: true,
            data: {
                ip,
                domain: cleanDomain,
                mxRecord: `mail.${cleanDomain}`,
                spfRecord: `v=spf1 mx ip4:${ip} ~all`,
                dkimRecord: dkimKey
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listMailboxes(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('cat /etc/vps-manager-mailboxes.txt 2>/dev/null || true');
        const lines = result.stdout.trim().split('\n').filter(Boolean);

        const mailboxes = [];
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const username = parts[0];
                const domain = parts[1];
                const createdAt = parts[2] || 'N/A';

                // Check mailbox disk size
                const sizeRes = await ssh.executeCommand(`du -sh /home/${username}/Maildir 2>/dev/null || echo "0B"`);
                const size = sizeRes.stdout.trim().split(/\s+/)[0] || '0B';

                mailboxes.push({
                    username,
                    email: `${username}@${domain}`,
                    domain,
                    createdAt,
                    size
                });
            }
        }

        res.json({
            success: true,
            data: mailboxes
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function createMailbox(req, res) {
    try {
        const { vpsConfig, username, password, domain } = req.body;
        const cleanUser = sanitizeEmailUsername(username);
        const cleanDomain = sanitizeAlphaNum(domain);

        if (!cleanUser || !password || !cleanDomain) {
            return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ tên tài khoản, mật khẩu và tên miền.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            USER="${cleanUser}"
            PASS=${escapeShellArg(password)}
            DOMAIN="${cleanDomain}"

            if id "$USER" &>/dev/null; then
                echo "ERROR_EXISTS"
                exit 1
            fi

            # Create user nologin
            useradd -m -s /usr/sbin/nologin "$USER"
            echo "$USER:$PASS" | chpasswd
            
            # Setup Maildir structure
            mkdir -p /home/"$USER"/Maildir/{new,cur,tmp}
            chown -R "$USER":"$USER" /home/"$USER"/Maildir
            chmod -R 700 /home/"$USER"/Maildir

            # Save in registry
            echo "$USER:$DOMAIN:$(date +%Y-%m-%d)" >> /etc/vps-manager-mailboxes.txt
            echo "SUCCESS"
        `;

        const result = await ssh.executeCommand(script);
        if (result.stdout.includes('ERROR_EXISTS')) {
            return res.status(400).json({ success: false, error: 'Tài khoản email này đã tồn tại trên máy chủ.' });
        }
        if (result.code !== 0 || !result.stdout.includes('SUCCESS')) {
            return res.status(500).json({ success: false, error: 'Tạo hòm thư thất bại.', details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: `Hòm thư ${cleanUser}@${cleanDomain} đã được tạo thành công!`
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteMailbox(req, res) {
    try {
        const { vpsConfig, username } = req.body;
        const cleanUser = sanitizeEmailUsername(username);

        if (!cleanUser) {
            return res.status(400).json({ success: false, error: 'Thiếu tên hòm thư cần xóa.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            USER="${cleanUser}"
            # Delete system user and home files
            userdel -r "$USER" 2>/dev/null || userdel -f "$USER" 2>/dev/null
            
            # Remove from registry
            sed -i "/^$USER:/d" /etc/vps-manager-mailboxes.txt
            echo "SUCCESS"
        `;

        await ssh.executeCommand(script);

        res.json({
            success: true,
            message: `Đã xóa hòm thư ${cleanUser} thành công!`
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getSMTPRelayConfig(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            # Parse relayhost from main.cf
            RELAY_HOST=""
            if [ -f /etc/postfix/main.cf ]; then
                RELAY_HOST=$(grep -E "^relayhost\\s*=" /etc/postfix/main.cf | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo "")
            fi
            
            # Parse user from sasl_passwd
            RELAY_USER=""
            if [ -f /etc/postfix/sasl_passwd ]; then
                # format: [smtp.sendgrid.net]:587 username:password
                RELAY_USER=$(cat /etc/postfix/sasl_passwd | head -1 | awk '{print $2}' | awk -F: '{print $1}' || echo "")
            fi

            echo "RELAY_HOST:$RELAY_HOST"
            echo "RELAY_USER:$RELAY_USER"
        `;

        const result = await ssh.executeCommand(script);
        const lines = result.stdout.trim().split('\n');
        
        let relayHost = '';
        let relayUser = '';

        lines.forEach(line => {
            if (line.startsWith('RELAY_HOST:')) {
                relayHost = line.replace('RELAY_HOST:', '').trim();
            } else if (line.startsWith('RELAY_USER:')) {
                relayUser = line.replace('RELAY_USER:', '').trim();
            }
        });

        res.json({
            success: true,
            data: {
                relayHost,
                relayUser
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveSMTPRelayConfig(req, res) {
    try {
        const { vpsConfig, relayHost, relayPort, relayUser, relayPass } = req.body;

        if (!relayHost || !relayPort) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin Host hoặc Port của SMTP Server.' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const hostVal = relayHost.trim();
        const portVal = parseInt(relayPort);
        const userVal = relayUser ? relayUser.trim() : '';
        const passVal = relayPass ? relayPass.trim() : '';

        const script = `
            HOST="${hostVal}"
            PORT="${portVal}"
            USER="${userVal}"
            PASS=${escapeShellArg(passVal)}

            if [ ! -f /etc/postfix/main.cf ]; then
                echo "ERROR_NOT_INSTALLED"
                exit 1
            fi

            # Backup main.cf
            cp /etc/postfix/main.cf /etc/postfix/main.cf.relay.bak 2>/dev/null || true

            # Delete existing relay host configs from main.cf
            sed -i '/^relayhost\\s*=/d' /etc/postfix/main.cf
            sed -i '/^smtp_sasl_/d' /etc/postfix/main.cf
            sed -i '/^smtp_tls_/d' /etc/postfix/main.cf

            # Append new relay configurations
            cat << EOF >> /etc/postfix/main.cf
relayhost = [\$HOST]:\$PORT
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
EOF

            # Write credentials to sasl_passwd
            echo "[\$HOST]:\$PORT \$USER:\$PASS" > /etc/postfix/sasl_passwd
            chmod 600 /etc/postfix/sasl_passwd
            
            # Run postmap to generate the db lookup file
            postmap /etc/postfix/sasl_passwd
            
            # Restart postfix
            systemctl restart postfix
            echo "SUCCESS"
        `;

        const result = await ssh.executeCommand(script);
        if (result.stdout.includes('ERROR_NOT_INSTALLED')) {
            return res.status(400).json({ success: false, error: 'Postfix chưa được cài đặt trên VPS này.' });
        }
        if (result.code !== 0 || !result.stdout.includes('SUCCESS')) {
            return res.status(500).json({ success: false, error: 'Cấu hình SMTP Relay thất bại.', details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: 'Đã lưu cấu hình và khởi chạy SMTP Relay thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getMailStatus,
    installMailServer,
    getDNSInstructions,
    listMailboxes,
    createMailbox,
    deleteMailbox,
    getSMTPRelayConfig,
    saveSMTPRelayConfig
};
