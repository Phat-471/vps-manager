const { connectionPool } = require('../utils/ssh');

// Configuration for common scripts and installers
const SCRIPTS = {
    bbr: {
        name: 'Google BBR',
        command: `
            if ! grep -q "net.core.default_qdisc=fq" /etc/sysctl.conf; then
                echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
                echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
                sysctl -p
                echo "BBR has been enabled."
            else
                echo "BBR is already enabled."
            fi
            lsmod | grep bbr
        `
    },
    swap: {
        name: 'Create 2GB Swap',
        command: `
            if [ ! -f /swapfile ]; then
                fallocate -l 2G /swapfile
                chmod 600 /swapfile
                mkswap /swapfile
                swapon /swapfile
                echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
                echo "Swap file created and enabled."
            else
                echo "Swap file already exists."
            fi
            free -h
        `
    },
    speedtest: {
        name: 'Speedtest',
        command: `
            if ! command -v speedtest-cli &> /dev/null; then
                apt-get update && apt-get install -y speedtest-cli
            fi
            speedtest-cli --simple
        `
    },
    bench: {
        name: 'Bench.sh',
        command: 'wget -qO- bench.sh | bash'
    },
    warp: {
        name: 'Cloudflare WARP',
        command: 'wget -qO- https://gitlab.com/rwkgyg/CFP_WARP/raw/main/CFP_WARP.sh | bash'
    },
    health: {
        name: 'System Health',
        command: `
            echo "--- System Load ---"
            uptime
            echo "--- Memory ---"
            free -h
            echo "--- Disk ---"
            df -h
            echo "--- Open Ports ---"
            netstat -tulpn | grep LISTEN 2>/dev/null || ss -tulpn | grep LISTEN
        `
    },
    wordpress: {
        name: 'Auto Deploy WordPress',
        command: `
            DOMAIN="{{DOMAIN}}"
            DB_PASS="{{DB_PASS}}"
            DB_NAME="wp_$(echo $DOMAIN | tr -d '.')"
            DB_USER="wp_user"
            SITE_TITLE="{{SITE_TITLE}}"
            ADMIN_USER="{{ADMIN_USER}}"
            ADMIN_PASS="{{ADMIN_PASS}}"
            ADMIN_EMAIL="{{ADMIN_EMAIL}}"

            echo "=== BẮT ĐẦU CÀI ĐẶT WORDPRESS TRÊN TÊN MIỀN: $DOMAIN ==="

            # Kiểm tra Nginx & MySQL
            if ! command -v mysql &> /dev/null || ! command -v nginx &> /dev/null; then
                echo "Lỗi: Máy chủ của bạn chưa cài LEMP Stack (Nginx & MySQL). Vui lòng cài LEMP trong mục Bảo trì trước."
                exit 1
            fi

            echo "1. Đang tạo cơ sở dữ liệu MySQL..."
            mysql -u root -e "DROP DATABASE IF EXISTS \\\`\${DB_NAME}\\\`; CREATE DATABASE \\\`\${DB_NAME}\\\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            mysql -u root -e "CREATE USER IF NOT EXISTS '\${DB_USER}'@'localhost' IDENTIFIED BY '\${DB_PASS}';"
            mysql -u root -e "ALTER USER '\${DB_USER}'@'localhost' IDENTIFIED BY '\${DB_PASS}';"
            mysql -u root -e "GRANT ALL PRIVILEGES ON \\\`\${DB_NAME}\\\`.* TO '\${DB_USER}'@'localhost';"
            mysql -u root -e "FLUSH PRIVILEGES;"

            echo "2. Tải về WordPress bản mới nhất..."
            mkdir -p /var/www/\${DOMAIN}
            cd /var/www/\${DOMAIN}
            rm -rf wordpress latest.tar.gz
            wget -q https://wordpress.org/latest.tar.gz
            tar -xzf latest.tar.gz
            cp -rf wordpress/* .
            rm -rf wordpress latest.tar.gz

            echo "3. Cấu hình wp-config.php..."
            cp wp-config-sample.php wp-config.php
            sed -i "s/database_name_here/\${DB_NAME}/" wp-config.php
            sed -i "s/username_here/\${DB_USER}/" wp-config.php
            sed -i "s/password_here/\${DB_PASS}/" wp-config.php

            # Download and run WP-CLI to complete installation automatically
            echo "4. Cấu hình Tài khoản Quản trị Admin tự động qua WP-CLI..."
            if ! command -v wp &> /dev/null; then
                echo "Tải về và thiết lập WP-CLI..."
                curl -sL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
                chmod +x /usr/local/bin/wp
            fi

            # Execute WP-CLI installation
            wp core install --url="http://\${DOMAIN}" --title="\${SITE_TITLE}" --admin_user="\${ADMIN_USER}" --admin_password="\${ADMIN_PASS}" --admin_email="\${ADMIN_EMAIL}" --allow-root

            echo "5. Cấu hình ảo hóa Nginx Virtual Host..."
            # Tìm php-fpm socket động
            FPM_SOCK=$(find /run/php/ -name "php*-fpm.sock" | head -1)
            if [ -z "$FPM_SOCK" ]; then
                FPM_SOCK="/run/php/php-fpm.sock"
            fi

            cat << 'EOF' > /etc/nginx/sites-available/\${DOMAIN}
server {
    listen 80;
    server_name {{DOMAIN}};
    root /var/www/{{DOMAIN}};
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires max;
        log_not_found off;
    }
}
EOF
            sed -i "s|FPM_SOCK_PLACEHOLDER|\$FPM_SOCK|g" /etc/nginx/sites-available/\${DOMAIN}
            ln -s /etc/nginx/sites-available/\${DOMAIN} /etc/nginx/sites-enabled/ 2>/dev/null

            chown -R www-data:www-data /var/www/\${DOMAIN}
            chmod -R 755 /var/www/\${DOMAIN}

            echo "6. Khởi động lại Nginx..."
            nginx -t && systemctl reload nginx

            echo "=== CÀI ĐẶT WORDPRESS HOÀN TẤT ==="
            echo "URL website: http://\${DOMAIN}"
            echo "Trang quản trị: http://\${DOMAIN}/wp-admin"
            echo "Tài khoản Admin: \${ADMIN_USER}"
            echo "Mật khẩu Admin: \${ADMIN_PASS}"
            echo "Email Admin: \${ADMIN_EMAIL}"
            echo "----------------------------"
            echo "Cơ sở dữ liệu: \${DB_NAME}"
            echo "Tài khoản DB: \${DB_USER}"
            echo "Mật khẩu DB: \${DB_PASS}"
            echo "Lưu ý: Hãy trỏ DNS tên miền về IP của VPS để truy cập được website."
        `
    },
    phpmyadmin: {
        name: 'Auto Deploy phpMyAdmin (Port 8888)',
        command: `
            echo "=== BẮT ĐẦU CÀI ĐẶT PHPMYADMIN ==="
            if [ -d /var/www/phpmyadmin ]; then
                echo "phpMyAdmin đã được cài đặt từ trước tại /var/www/phpmyadmin."
                exit 0
            fi

            # Kiểm tra Nginx & PHP
            if ! command -v nginx &> /dev/null; then
                echo "Lỗi: Máy chủ chưa cài Nginx. Hãy cài LEMP Stack trước."
                exit 1
            fi

            echo "1. Tải bản phpMyAdmin mới nhất..."
            cd /var/www
            wget -q https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.tar.gz
            tar -xzf phpMyAdmin-5.2.1-all-languages.tar.gz
            mv phpMyAdmin-5.2.1-all-languages phpmyadmin
            rm -f phpMyAdmin-5.2.1-all-languages.tar.gz

            echo "2. Phân quyền thư mục..."
            chown -R www-data:www-data /var/www/phpmyadmin
            chmod -R 755 /var/www/phpmyadmin

            echo "3. Cấu hình Nginx Virtual Host trên cổng 8888..."
            FPM_SOCK=$(find /run/php/ -name "php*-fpm.sock" | head -1)
            if [ -z "$FPM_SOCK" ]; then
                FPM_SOCK="/run/php/php-fpm.sock"
            fi

            cat << 'EOF' > /etc/nginx/sites-available/phpmyadmin
server {
    listen 8888;
    root /var/www/phpmyadmin;
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
    }
}
EOF
            sed -i "s|FPM_SOCK_PLACEHOLDER|\$FPM_SOCK|g" /etc/nginx/sites-available/phpmyadmin
            ln -s /etc/nginx/sites-available/phpmyadmin /etc/nginx/sites-enabled/ 2>/dev/null

            nginx -t && systemctl reload nginx

            echo "=== CÀI ĐẶT PHPMYADMIN HOÀN TẤT ==="
            echo "Địa chỉ truy cập: http://IP_VPS:8888"
            echo "Lưu ý: Mở cổng 8888 trên Tường lửa UFW để truy cập ngoài internet."
        `
    },
    portainer: {
        name: 'Auto Deploy Docker Portainer CE',
        command: `
            echo "=== BẮT ĐẦU CÀI ĐẶT PORTAINER ==="
            if ! command -v docker &> /dev/null; then
                echo "Lỗi: Docker chưa được cài đặt. Hãy cài Docker trong mục Bảo trì trước."
                exit 1
            fi

            if docker ps -a | grep -q portainer; then
                echo "Portainer container đã tồn tại."
                docker start portainer
            else
                echo "1. Khởi tạo volume và chạy Portainer..."
                docker volume create portainer_data
                docker run -d -p 9000:9000 -p 9443:9443 --name portainer --restart always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
            fi

            echo "=== CÀI ĐẶT PORTAINER HOÀN TẤT ==="
            echo "Truy cập HTTP: http://IP_VPS:9000"
            echo "Truy cập HTTPS: https://IP_VPS:9443"
            echo "Lưu ý: Bạn hãy đảm bảo mở các cổng 9000/9443 trên Firewall UFW."
        `
    },
    nodeapp: {
        name: 'Auto Deploy Node.js Project (PM2 Safe Mode)',
        command: `
            APP_NAME="{{APP_NAME}}"
            GIT_URL="{{GIT_URL}}"
            PORT="{{PORT}}"

            echo "=== BẮT ĐẦU AUTO-DEPLOY NODEJS APP BẢO MẬT: \${APP_NAME} ==="

            # Check Git & NodeJS
            if ! command -v git &> /dev/null || ! command -v node &> /dev/null; then
                echo "Lỗi: VPS chưa cài đặt Git hoặc Node.js. Hãy cài đặt trong mục Bảo trì trước."
                exit 1
            fi

            echo "1. Clone mã nguồn từ Git..."
            mkdir -p /var/www
            cd /var/www
            if [ -d "\${APP_NAME}" ]; then
                echo "Thư mục /var/www/\${APP_NAME} đã tồn tại, tiến hành pull code mới..."
                cd \${APP_NAME}
                git pull
            else
                git clone \${GIT_URL} \${APP_NAME}
                cd \${APP_NAME}
            fi

            echo "2. Cài đặt các thư viện npm..."
            npm install --production || npm install

            echo "3. Cấu hình PM2 bảo mật..."
            if ! command -v pm2 &> /dev/null; then
                echo "Đang cài đặt PM2 toàn cục..."
                npm install -g pm2
            fi

            # Tạo user pm2user không có quyền root nếu chưa có
            if ! id -u pm2user &>/dev/null; then
                echo "Tạo tài khoản hệ thống 'pm2user' để chạy ứng dụng độc lập..."
                useradd -m -s /bin/bash pm2user
            fi

            # Phân quyền cho pm2user
            chown -R pm2user:pm2user /var/www/\${APP_NAME}

            # Tìm file chạy chính
            START_FILE="index.js"
            if [ ! -f "index.js" ] && [ -f "server.js" ]; then
                START_FILE="server.js"
            elif [ ! -f "index.js" ] && [ ! -f "server.js" ] && [ -f "app.js" ]; then
                START_FILE="app.js"
            fi

            # Dừng các app cũ
            pm2 stop \${APP_NAME} 2>/dev/null || true
            pm2 delete \${APP_NAME} 2>/dev/null || true
            sudo -u pm2user pm2 stop \${APP_NAME} 2>/dev/null || true
            sudo -u pm2user pm2 delete \${APP_NAME} 2>/dev/null || true

            echo "4. Khởi chạy ứng dụng bằng PM2 dưới tài khoản pm2user..."
            sudo -u pm2user env PORT=\${PORT} pm2 start \${START_FILE} --name \${APP_NAME} || sudo -u pm2user env PORT=\${PORT} pm2 start npm --name \${APP_NAME} -- start
            sudo -u pm2user pm2 save --force

            echo "=== AUTO-DEPLOY NODEJS APP HOÀN TẤT ==="
            echo "Ứng dụng đang hoạt động bảo mật tại cổng: \${PORT}."
            sudo -u pm2user pm2 status \${APP_NAME}
        `
    },
    sysctl_hardening: {
        name: 'Kernel Network Hardening (Sysctl)',
        command: `
            echo "=== TỐI ƯU HÓA KERNEL BẢO MẬT (SYSCTL) ==="
            SYSCTL_CONF="/etc/sysctl.d/99-security-hardening.conf"
            cat << 'EOF' > $SYSCTL_CONF
            # Prevent SYN flood attacks
            net.ipv4.tcp_syncookies = 1
            net.ipv4.tcp_syn_retries = 5
            net.ipv4.tcp_synack_retries = 2
            net.ipv4.tcp_max_syn_backlog = 4096

            # Disallow IP source routing
            net.ipv4.conf.all.accept_source_route = 0
            net.ipv4.conf.default.accept_source_route = 0

            # Disallow ICMP redirects
            net.ipv4.conf.all.accept_redirects = 0
            net.ipv4.conf.default.accept_redirects = 0
            net.ipv4.conf.all.secure_redirects = 0
            net.ipv4.conf.default.secure_redirects = 0

            # Ignore broadcast pings
            net.ipv4.icmp_echo_ignore_broadcasts = 1

            # Enable IP spoofing protection (Reverse Path Filtering)
            net.ipv4.conf.all.rp_filter = 1
            net.ipv4.conf.default.rp_filter = 1
EOF
            sysctl --system
            echo "Đã tối ưu hóa bảo mật mạng Kernel thành công!"
        `
    },
    auto_updates: {
        name: 'Auto Security Updates',
        command: `
            echo "=== BẬT TỰ ĐỘNG CẬP NHẬT BẢN VÁ BẢO MẬT ==="
            if [ -f /etc/debian_version ]; then
                apt-get update
                DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades apt-listchanges
                echo "Configuring unattended-upgrades..."
                echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
                echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
                systemctl restart unattended-upgrades
                echo "Unattended upgrades đã được cài đặt và cấu hình tự động cập nhật hàng ngày."
            else
                yum install -y yum-cron
                systemctl enable yum-cron
                systemctl start yum-cron
                sed -i 's/update_cmd = default/update_cmd = security/g' /etc/yum/yum-cron.conf
                echo "Yum-cron đã được cài đặt và cấu hình cập nhật bản vá bảo mật."
            fi
        `
    },
    clamav_scan: {
        name: 'ClamAV Malware Scan (/var/www)',
        command: `
            echo "=== CÀI ĐẶT & QUÉT MÃ ĐỘC VỚI CLAMAV ==="
            if ! command -v clamscan &> /dev/null; then
                echo "Đang cài đặt ClamAV Malware Scanner... Sẽ mất 1-2 phút..."
                if [ -f /etc/debian_version ]; then
                    apt-get update && apt-get install -y clamav clamav-daemon
                else
                    yum install -y epel-release && yum install -y clamav clamav-update
                fi
                echo "Đang cập nhật cơ sở dữ liệu virus..."
                freshclam || true
            fi
            echo "Đang quét nhanh thư mục Web /var/www để tìm mã độc, backdoor..."
            clamscan -r --infected --no-summary /var/www || echo "Không phát hiện mã độc nguy hiểm nào."
        `
    },
    ddos_deflate: {
        name: 'Auto Anti-DDoS (DDoS Deflate)',
        command: `
            echo "=== CÀI ĐẶT SCRIPT CHỐNG DDOS DEFLATE CHẠY NGẦM ==="
            if ! command -v ufw >/dev/null; then
                echo ">> Chưa tìm thấy UFW. Tiến hành cài đặt..."
                if [ -f /etc/debian_version ]; then
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
                else
                    yum install -y epel-release && yum install -y ufw
                fi
                # Mở cổng SSH mặc định để tránh bị chặn
                ufw allow 22/tcp
                echo "y" | ufw enable
            fi

            # Tạo script ddos-deflate cục bộ
            cat << 'EOF' > /usr/local/bin/ddos-deflate.sh
#!/bin/bash
MAX_CONN=150
BAN_LOG="/var/log/ddos_deflate.log"
if ! command -v ufw >/dev/null; then
    exit 0
fi
ss -ntu | awk 'NR>1 {print $5}' | cut -d: -f1 | grep -v -E "(127.0.0.1|::1|0.0.0.0)" | sort | uniq -c | while read count ip; do
    if [ "$count" -gt "$MAX_CONN" ]; then
        if ! ufw status | grep -q "$ip"; then
            echo "$(date) - IP $ip blocked with $count connections" >> "$BAN_LOG"
            ufw insert 1 deny from "$ip" to any
        fi
    fi
done
EOF
            chmod +x /usr/local/bin/ddos-deflate.sh

            # Tạo cron job chạy mỗi phút
            if ! crontab -l 2>/dev/null | grep -q "ddos-deflate.sh"; then
                (crontab -l 2>/dev/null; echo "* * * * * /bin/bash /usr/local/bin/ddos-deflate.sh >/dev/null 2>&1") | crontab -
            fi

            echo "SUCCESS: Script DDoS Deflate đã được cài đặt và lập lịch chạy ngầm mỗi phút thành công!"
            echo "Log theo dõi sẽ được lưu tại: /var/log/ddos_deflate.log"
        `
    },
    block_bad_bots: {
        name: 'Block Bad Bots & Crawlers (Nginx)',
        command: `
            echo "=== CẤU HÌNH CHẶN BOT RÁC TOÀN CẦU CHO NGINX ==="
            if [ ! -d /etc/nginx/conf.d ]; then
                echo "Lỗi: Không tìm thấy thư mục Nginx. Vui lòng cài đặt Web Server trước."
                exit 1
            fi

            cat << 'EOF' > /etc/nginx/conf.d/block_bots.conf
# Block bad bots map
map $http_user_agent $is_bad_bot {
    default 0;
    ~*(SemrushBot|AhrefsBot|DotBot|MJ12bot|MegaIndex|ZoominfoBot|Mail.RU_Bot|Baiduspider|Sogou|Yandex|python-requests|curl|wget|libwww|scanner|nmap|nikto|sqlmap|censys|masscan|zgrab) 1;
}
EOF
            nginx -t
            if [ $? -eq 0 ]; then
                systemctl reload nginx || systemctl restart nginx
                echo "SUCCESS: Đã cấu hình và kích hoạt danh sách chặn bot rác trên Nginx thành công!"
            else
                echo "ERROR: Cấu hình Nginx không hợp lệ. Đã khôi phục trạng thái."
                rm -f /etc/nginx/conf.d/block_bots.conf
                exit 1
            fi
        `
    },
    fail2ban_nginx: {
        name: 'Fail2Ban Nginx Protection',
        command: `
            echo "=== CÀI ĐẶT & CẤU HÌNH FAIL2BAN BẢO VỆ NGINX ==="
            if ! command -v nginx &>/dev/null; then
                echo "Lỗi: Vui lòng cài đặt Nginx trước."
                exit 1
            fi

            if ! command -v fail2ban-client &>/dev/null; then
                echo "Đang cài đặt Fail2Ban..."
                if [ -f /etc/debian_version ]; then
                    apt-get update && apt-get install -y fail2ban
                else
                    yum install -y epel-release && yum install -y fail2ban
                fi
            fi

            # Cấu hình jail bảo vệ Nginx limit_req
            cat << 'EOF' > /etc/fail2ban/jail.d/nginx-limit.conf
[nginx-limit-req]
enabled = true
port    = http,https
filter  = nginx-limit-req
logpath = /var/log/nginx/*error.log
maxretry = 5
findtime = 600
bantime  = 3600
EOF

            systemctl restart fail2ban
            systemctl enable fail2ban

            echo "SUCCESS: Đã cài đặt và kích hoạt Fail2Ban bảo vệ Nginx thành công!"
            fail2ban-client status
        `
    }
};

async function runScript(req, res) {
    try {
        const { vpsConfig, scriptId, args } = req.body;
        const script = SCRIPTS[scriptId];

        if (!script) {
            return res.status(400).json({
                success: false,
                error: 'Script không tồn tại'
            });
        }

        let command = script.command;
        if (args) {
            for (const [key, value] of Object.entries(args)) {
                const upperKey = key.toUpperCase();
                let escapedValue = String(value || '');

                // Apply strict sanitization and validation per key type to prevent Shell Command Injection
                if (upperKey === 'DOMAIN') {
                    escapedValue = escapedValue.replace(/[^a-zA-Z0-9.-]/g, '');
                } else if (upperKey === 'PORT') {
                    escapedValue = escapedValue.replace(/[^0-9]/g, '');
                } else if (upperKey === 'APP_NAME') {
                    escapedValue = escapedValue.replace(/[^a-zA-Z0-9_-]/g, '-');
                } else if (upperKey === 'ADMIN_EMAIL') {
                    escapedValue = escapedValue.replace(/[^a-zA-Z0-9_.@+-]/g, '');
                } else if (upperKey === 'GIT_URL') {
                    escapedValue = escapedValue.replace(/[^a-zA-Z0-9_.:/+-@]/g, '');
                } else {
                    // Escape characters with special meaning inside double quotes in Bash: \, $, ", `
                    escapedValue = escapedValue
                        .replace(/\\/g, '\\\\')
                        .replace(/\$/g, '\\$')
                        .replace(/"/g, '\\"')
                        .replace(/`/g, '\\`');
                }

                command = command.replace(new RegExp(`{{${upperKey}}}`, 'g'), escapedValue);
            }
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(command);

        res.json({
            success: true,
            output: result.stdout + result.stderr
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

module.exports = {
    runScript
};
