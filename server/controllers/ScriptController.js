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
        name: 'Auto Deploy Node.js Project from Git',
        command: `
            APP_NAME="{{APP_NAME}}"
            GIT_URL="{{GIT_URL}}"
            PORT="{{PORT}}"

            echo "=== BẮT ĐẦU AUTO-DEPLOY NODEJS APP: \${APP_NAME} ==="

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

            echo "3. Cấu hình PM2..."
            if ! command -v pm2 &> /dev/null; then
                echo "Đang cài đặt PM2 toàn cục..."
                npm install -g pm2
            fi

            echo "4. Khởi chạy ứng dụng với PM2..."
            # Tìm file chạy chính
            START_FILE="index.js"
            if [ ! -f "index.js" ] && [ -f "server.js" ]; then
                START_FILE="server.js"
            elif [ ! -f "index.js" ] && [ ! -f "server.js" ] && [ -f "app.js" ]; then
                START_FILE="app.js"
            fi

            pm2 stop \th_app_placeholder 2>/dev/null || true
            pm2 delete \th_app_placeholder 2>/dev/null || true
            # Chạy pm2 xóa app cũ
            pm2 stop \${APP_NAME} 2>/dev/null || true
            pm2 delete \${APP_NAME} 2>/dev/null || true

            PORT=\${PORT} pm2 start \${START_FILE} --name \${APP_NAME} || PORT=\${PORT} pm2 start npm --name \${APP_NAME} -- start
            pm2 save --force

            echo "=== AUTO-DEPLOY NODEJS APP HOÀN TẤT ==="
            echo "Ứng dụng đang hoạt động tại cổng: \${PORT}."
            pm2 status \${APP_NAME}
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
                command = command.replace(new RegExp(`{{${key.toUpperCase()}}}`, 'g'), value);
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
