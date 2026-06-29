const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg } = require('../utils/security');
const crypto = require('crypto');

function generatePassword(length = 16) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

async function installWordPress(req, res) {
    try {
        const { 
            vpsConfig, 
            domain, 
            email, 
            siteTitle, 
            adminUser, 
            adminPass, 
            dbName: customDbName, 
            dbUser: customDbUser, 
            dbPass: customDbPass,
            phpVersion,
            ssl
        } = req.body;

        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }

        const cleanDomain = safeDomain.replace(/\./g, '_');
        const dbName = customDbName ? customDbName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) : `wp_${cleanDomain}`.slice(0, 32);
        const dbUser = customDbUser ? customDbUser.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) : `wp_u_${cleanDomain}`.slice(0, 16);
        const dbPass = customDbPass ? customDbPass.replace(/['"\\]/g, '') : generatePassword(16);

        const adminEmail = email ? email.trim() : `admin@${safeDomain}`;
        const finalSiteTitle = siteTitle ? siteTitle.trim() : 'WordPress Website';
        const finalAdminUser = adminUser ? sanitizeAlphaNum(adminUser).trim() : 'admin';
        const finalAdminPass = adminPass ? adminPass : generatePassword(12);

        const escapedSiteTitle = escapeShellArg(finalSiteTitle);
        const escapedAdminUser = escapeShellArg(finalAdminUser);
        const escapedAdminPass = escapeShellArg(finalAdminPass);
        const escapedAdminEmail = escapeShellArg(adminEmail);

        let sslCmd = '';
        if (ssl === true || ssl === 'true') {
            sslCmd = `
                echo ">> Đang cài đặt SSL Let's Encrypt qua Certbot..."
                if ! command -v certbot &> /dev/null; then
                    echo ">> Cài đặt Certbot..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
                    else
                        yum install -y epel-release && yum install -y certbot python3-certbot-nginx
                    fi
                fi
                certbot --nginx -d ${safeDomain} -d www.${safeDomain} --non-interactive --agree-tos -m ${escapedAdminEmail} --redirect || certbot --nginx -d ${safeDomain} --non-interactive --agree-tos -m ${escapedAdminEmail} --redirect || echo ">> Cảnh báo: Lỗi khi cấp chứng chỉ SSL Certbot."
            `;
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Check if MySQL is installed
        const dbCheck = await ssh.executeCommand('which mysql');
        if (dbCheck.code !== 0) {
            return res.status(400).json({ success: false, error: 'MySQL chưa được cài đặt trên VPS này' });
        }

        const script = `
            set -e
            echo ">> Đang chuẩn bị thư mục..."
            mkdir -p /var/www/${safeDomain}
            cd /var/www/${safeDomain}

            echo ">> Tải mã nguồn WordPress..."
            wget -q https://wordpress.org/latest.tar.gz -O /tmp/wordpress_${safeDomain}.tar.gz
            
            echo ">> Giải nén mã nguồn..."
            tar -xzf /tmp/wordpress_${safeDomain}.tar.gz -C /var/www/${safeDomain} --strip-components=1
            rm -f /tmp/wordpress_${safeDomain}.tar.gz

            echo ">> Tạo cơ sở dữ liệu MySQL..."
            mysql -e "CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            mysql -e "CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}';"
            mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'%';"
            mysql -e "FLUSH PRIVILEGES;"

            echo ">> Cấu hình wp-config.php..."
            cp wp-config-sample.php wp-config.php
            sed -i "s/database_name_here/${dbName}/g" wp-config.php
            sed -i "s/username_here/${dbUser}/g" wp-config.php
            sed -i "s/password_here/${dbPass}/g" wp-config.php
            sed -i "s/localhost/127.0.0.1/g" wp-config.php

            echo ">> Tải Salts bảo mật từ api.wordpress.org..."
            SALTS=$(curl -s https://api.wordpress.org/secret-key/1.1/salt/ || echo "")
            if [ -n "$SALTS" ]; then
                # Xóa các dòng salt cũ trong wp-config.php
                sed -i '/AUTH_KEY/,/NONCE_SALT/d' wp-config.php
                # Chèn salts mới
                echo "$SALTS" >> wp-config.php
            fi

            echo ">> Phân quyền thư mục sơ bộ..."
            chown -R www-data:www-data /var/www/${safeDomain}
            find /var/www/${safeDomain} -type d -exec chmod 755 {} \\;
            find /var/www/${safeDomain} -type f -exec chmod 644 {} \\;

            echo ">> Cấu hình Tài khoản Quản trị Admin tự động qua WP-CLI..."
            if ! command -v wp &> /dev/null; then
                echo ">> Tải về và thiết lập WP-CLI..."
                curl -sL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
                chmod +x /usr/local/bin/wp
            fi

            # Execute WP-CLI installation
            wp core install --url="http://${safeDomain}" --title=${escapedSiteTitle} --admin_user=${escapedAdminUser} --admin_password=${escapedAdminPass} --admin_email=${escapedAdminEmail} --allow-root

            echo ">> Tìm socket PHP-FPM..."
            FPM_SOCK="/run/php/php${phpVersion || ''}-fpm.sock"
            if [ -z "${phpVersion || ''}" ] || [ ! -S "\$FPM_SOCK" ]; then
                FPM_SOCK=\$(find /run/php/ -name "php*-fpm.sock" | head -1)
                if [ -z "\$FPM_SOCK" ]; then
                    FPM_SOCK="/var/run/php/php-fpm.sock"
                fi
            fi

            echo ">> Tạo cấu hình Nginx..."
            cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};
    root /var/www/${safeDomain};
    index index.php index.html index.htm;

    client_max_body_size 64M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
        fastcgi_read_timeout 300;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires max;
        log_not_found off;
        access_log off;
    }

    location = /xmlrpc.php {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
            sed -i "s|FPM_SOCK_PLACEHOLDER|\$FPM_SOCK|g" /etc/nginx/sites-available/${safeDomain}

            echo ">> Kích hoạt cấu hình Nginx..."
            ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
            nginx -t
            systemctl reload nginx

            ${sslCmd}

            echo ">> Phân quyền lại toàn bộ thư mục..."
            chown -R www-data:www-data /var/www/${safeDomain}
            find /var/www/${safeDomain} -type d -exec chmod 755 {} \\;
            find /var/www/${safeDomain} -type f -exec chmod 644 {} \\;

            echo ">> WordPress đã được cài đặt thành công!"
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Cài đặt WordPress thất bại', details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: `Cài đặt WordPress thành công trên tên miền ${safeDomain}!`,
            data: {
                dbName,
                dbUser,
                dbPass,
                adminUser: finalAdminUser,
                adminPass: finalAdminPass,
                adminEmail,
                siteTitle: finalSiteTitle,
                siteUrl: `http://${safeDomain}`
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installLaravel(req, res) {
    try {
        const { 
            vpsConfig, 
            domain, 
            email,
            dbName: customDbName, 
            dbUser: customDbUser, 
            dbPass: customDbPass,
            phpVersion,
            ssl
        } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }

        const cleanDomain = safeDomain.replace(/\./g, '_');
        const dbName = customDbName ? customDbName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) : `la_${cleanDomain}`.slice(0, 32);
        const dbUser = customDbUser ? customDbUser.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) : `la_u_${cleanDomain}`.slice(0, 16);
        const dbPass = customDbPass ? customDbPass.replace(/['"\\]/g, '') : generatePassword(16);

        const adminEmail = email ? email.trim() : `admin@${safeDomain}`;
        const escapedAdminEmail = escapeShellArg(adminEmail);

        let sslCmd = '';
        if (ssl === true || ssl === 'true') {
            sslCmd = `
                echo ">> Đang cài đặt SSL Let's Encrypt qua Certbot..."
                if ! command -v certbot &> /dev/null; then
                    echo ">> Cài đặt Certbot..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
                    else
                        yum install -y epel-release && yum install -y certbot python3-certbot-nginx
                    fi
                fi
                certbot --nginx -d ${safeDomain} -d www.${safeDomain} --non-interactive --agree-tos -m ${escapedAdminEmail} --redirect || certbot --nginx -d ${safeDomain} --non-interactive --agree-tos -m ${escapedAdminEmail} --redirect || echo ">> Cảnh báo: Lỗi khi cấp chứng chỉ SSL Certbot."
            `;
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Check if MySQL & Composer are available
        const dbCheck = await ssh.executeCommand('which mysql');
        if (dbCheck.code !== 0) {
            return res.status(400).json({ success: false, error: 'MySQL chưa được cài đặt trên VPS này' });
        }

        const script = `
            set -e
            echo ">> Đang chuẩn bị thư mục..."
            mkdir -p /var/www/${safeDomain}
            cd /var/www/${safeDomain}

            echo ">> Tải cấu trúc Laravel Clean Release..."
            wget -q https://github.com/laravel/laravel/archive/refs/tags/v11.0.0.tar.gz -O /tmp/laravel_${safeDomain}.tar.gz
            
            echo ">> Giải nén..."
            tar -xzf /tmp/laravel_${safeDomain}.tar.gz -C /var/www/${safeDomain} --strip-components=1
            rm -f /tmp/laravel_${safeDomain}.tar.gz

            echo ">> Cấu hình tệp .env..."
            cp .env.example .env
            sed -i "s/DB_DATABASE=.*/DB_DATABASE=${dbName}/g" .env
            sed -i "s/DB_USERNAME=.*/DB_USERNAME=${dbUser}/g" .env
            sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${dbPass}/g" .env

            echo ">> Tạo cơ sở dữ liệu MySQL..."
            mysql -e "CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            mysql -e "CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}';"
            mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'%';"
            mysql -e "FLUSH PRIVILEGES;"

            echo ">> Cài đặt Composer Dependencies..."
            if command -v composer >/dev/null; then
                composer install --no-dev --optimize-autoloader --no-interaction
            else
                echo ">> Composer chưa được cài đặt! Đang tải composer.phar..."
                curl -sS https://getcomposer.org/installer | php
                php composer.phar install --no-dev --optimize-autoloader --no-interaction
            fi

            echo ">> Khởi tạo Application Key..."
            php artisan key:generate

            echo ">> Cấu hình phân quyền storage..."
            chown -R www-data:www-data /var/www/${safeDomain}
            chmod -R 775 /var/www/${safeDomain}/storage
            chmod -R 775 /var/www/${safeDomain}/bootstrap/cache

            echo ">> Tìm socket PHP-FPM..."
            FPM_SOCK="/run/php/php${phpVersion || ''}-fpm.sock"
            if [ -z "${phpVersion || ''}" ] || [ ! -S "\$FPM_SOCK" ]; then
                FPM_SOCK=\$(find /run/php/ -name "php*-fpm.sock" | head -1)
                if [ -z "\$FPM_SOCK" ]; then
                    FPM_SOCK="/var/run/php/php-fpm.sock"
                fi
            fi

            echo ">> Tạo cấu hình Nginx cho Laravel..."
            cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};
    root /var/www/${safeDomain}/public;
    index index.php index.html index.htm;

    client_max_body_size 64M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
        fastcgi_read_timeout 300;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires max;
        log_not_found off;
        access_log off;
    }
}
EOF
            sed -i "s|FPM_SOCK_PLACEHOLDER|\$FPM_SOCK|g" /etc/nginx/sites-available/${safeDomain}

            echo ">> Kích hoạt cấu hình Nginx..."
            ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
            nginx -t
            systemctl reload nginx

            ${sslCmd}

            echo ">> Laravel đã được cài đặt thành công!"
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Cài đặt Laravel thất bại', details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: `Cài đặt Laravel thành công trên tên miền ${safeDomain}!`,
            data: {
                dbName,
                dbUser,
                dbPass,
                siteUrl: (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}


async function prepareInstallation(req, res) {
    try {
        const { 
            vpsConfig, 
            appId, 
            domain, 
            email, 
            appName, 
            gitUrl, 
            port,
            siteTitle, 
            adminUser, 
            adminPass, 
            dbName: customDbName, 
            dbUser: customDbUser, 
            dbPass: customDbPass,
            pmaPort,
            pmaUser,
            pmaPassword,
            phpVersion,
            ssl
        } = req.body;
        const host = vpsConfig?.host || 'localhost';

        let sslCmd = '';
        if (ssl === true || ssl === 'true') {
            const domainName = domain ? domain.trim() : '';
            const safeDomain = sanitizeAlphaNum(domainName);
            const adminEmail = email ? email.trim() : `admin@${safeDomain}`;
            const escapedAdminEmail = escapeShellArg(adminEmail);
            if (safeDomain) {
                sslCmd = `
                    echo ">> Đang cài đặt SSL Let's Encrypt qua Certbot..."
                    if ! command -v certbot &> /dev/null; then
                        echo ">> Cài đặt Certbot..."
                        if [ -f /etc/debian_version ]; then
                            while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                            apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
                        else
                            yum install -y epel-release && yum install -y certbot python3-certbot-nginx
                        fi
                    fi
                    certbot --nginx -d ${safeDomain} -d www.${safeDomain} --non-interactive --agree-tos -m ${escapedAdminEmail} --redirect || certbot --nginx -d ${safeDomain} --non-interactive --agree-tos -m ${escapedAdminEmail} --redirect || echo ">> Cảnh báo: Lỗi khi cấp chứng chỉ SSL Certbot."
                `;
            }
        }

        if (appId === 'wordpress') {
            const safeDomain = sanitizeAlphaNum(domain);
            if (!safeDomain) {
                return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
            }

            const cleanDomain = safeDomain.replace(/\./g, '_');
            const dbName = customDbName ? customDbName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) : `wp_${cleanDomain}`.slice(0, 32);
            const dbUser = customDbUser ? customDbUser.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) : `wp_u_${cleanDomain}`.slice(0, 16);
            const dbPass = customDbPass ? customDbPass.replace(/['"\\]/g, '') : generatePassword(16);

            const adminEmail = email ? email.trim() : `admin@${safeDomain}`;
            const finalSiteTitle = siteTitle ? siteTitle.trim() : 'WordPress Website';
            const finalAdminUser = adminUser ? sanitizeAlphaNum(adminUser).trim() : 'admin';
            const finalAdminPass = adminPass ? adminPass : generatePassword(12);

            const escapedSiteTitle = escapeShellArg(finalSiteTitle);
            const escapedAdminUser = escapeShellArg(finalAdminUser);
            const escapedAdminPass = escapeShellArg(finalAdminPass);
            const escapedAdminEmail = escapeShellArg(adminEmail);

            const command = `
                set -e
                echo ">> Đang chuẩn bị thư mục..."
                mkdir -p /var/www/${safeDomain}
                cd /var/www/${safeDomain}

                echo ">> Tải mã nguồn WordPress..."
                wget -q https://wordpress.org/latest.tar.gz -O /tmp/wordpress_${safeDomain}.tar.gz
                
                echo ">> Giải nén mã nguồn..."
                tar -xzf /tmp/wordpress_${safeDomain}.tar.gz -C /var/www/${safeDomain} --strip-components=1
                rm -f /tmp/wordpress_${safeDomain}.tar.gz

                echo ">> Tạo cơ sở dữ liệu MySQL..."
                mysql -e "CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                mysql -e "CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}';"
                mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'%';"
                mysql -e "FLUSH PRIVILEGES;"

                echo ">> Cấu hình wp-config.php..."
                cp wp-config-sample.php wp-config.php
                sed -i "s/database_name_here/${dbName}/g" wp-config.php
                sed -i "s/username_here/${dbUser}/g" wp-config.php
                sed -i "s/password_here/${dbPass}/g" wp-config.php
                sed -i "s/localhost/127.0.0.1/g" wp-config.php

                echo ">> Tải Salts bảo mật từ api.wordpress.org..."
                SALTS=$(curl -s https://api.wordpress.org/secret-key/1.1/salt/ || echo "")
                if [ -n "$SALTS" ]; then
                    # Xóa các dòng salt cũ trong wp-config.php
                    sed -i '/AUTH_KEY/,/NONCE_SALT/d' wp-config.php
                    # Chèn salts mới
                    echo "$SALTS" >> wp-config.php
                fi

                echo ">> Phân quyền thư mục sơ bộ..."
                chown -R www-data:www-data /var/www/${safeDomain}
                find /var/www/${safeDomain} -type d -exec chmod 755 {} \\;
                find /var/www/${safeDomain} -type f -exec chmod 644 {} \\;

                echo ">> Cấu hình Tài khoản Quản trị Admin tự động qua WP-CLI..."
                if ! command -v wp &> /dev/null; then
                    echo ">> Tải về và thiết lập WP-CLI..."
                    curl -sL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
                    chmod +x /usr/local/bin/wp
                fi

                # Execute WP-CLI installation
                wp core install --url="http://${safeDomain}" --title=${escapedSiteTitle} --admin_user=${escapedAdminUser} --admin_password=${escapedAdminPass} --admin_email=${escapedAdminEmail} --allow-root

                echo ">> Tìm socket PHP-FPM..."
                FPM_SOCK="/run/php/php${phpVersion || ''}-fpm.sock"
                if [ -z "${phpVersion || ''}" ] || [ ! -S "\$FPM_SOCK" ]; then
                    FPM_SOCK=\$(find /run/php/ -name "php*-fpm.sock" | head -1)
                    if [ -z "\$FPM_SOCK" ]; then
                        FPM_SOCK="/var/run/php/php-fpm.sock"
                    fi
                fi

                echo ">> Tạo cấu hình Nginx..."
                cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};
    root /var/www/${safeDomain};
    index index.php index.html index.htm;

    client_max_body_size 64M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
        fastcgi_read_timeout 300;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires max;
        log_not_found off;
        access_log off;
    }

    location = /xmlrpc.php {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
                sed -i "s|FPM_SOCK_PLACEHOLDER|\$FPM_SOCK|g" /etc/nginx/sites-available/${safeDomain}

                echo ">> Kích hoạt cấu hình Nginx..."
                ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                nginx -t
                systemctl reload nginx

                ${sslCmd}

                echo ">> Phân quyền lại toàn bộ thư mục..."
                chown -R www-data:www-data /var/www/${safeDomain}
                find /var/www/${safeDomain} -type d -exec chmod 755 {} \\;
                find /var/www/${safeDomain} -type f -exec chmod 644 {} \\;

                echo ">> WordPress đã được cài đặt thành công!"
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    dbName,
                    dbUser,
                    dbPass,
                    adminUser: finalAdminUser,
                    adminPass: finalAdminPass,
                    adminEmail,
                    siteTitle: finalSiteTitle,
                    siteUrl: (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`
                }
            });
        } 
        
        if (appId === 'laravel') {
            const safeDomain = sanitizeAlphaNum(domain);
            if (!safeDomain) {
                return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
            }

            const cleanDomain = safeDomain.replace(/\./g, '_');
            const dbName = customDbName ? customDbName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) : `la_${cleanDomain}`.slice(0, 32);
            const dbUser = customDbUser ? customDbUser.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) : `la_u_${cleanDomain}`.slice(0, 16);
            const dbPass = customDbPass ? customDbPass.replace(/['"\\]/g, '') : generatePassword(16);

            const command = `
                set -e
                echo ">> Đang chuẩn bị thư mục..."
                mkdir -p /var/www/${safeDomain}
                cd /var/www/${safeDomain}

                echo ">> Tải cấu trúc Laravel Clean Release..."
                wget -q https://github.com/laravel/laravel/archive/refs/tags/v11.0.0.tar.gz -O /tmp/laravel_${safeDomain}.tar.gz
                
                echo ">> Giải nén..."
                tar -xzf /tmp/laravel_${safeDomain}.tar.gz -C /var/www/${safeDomain} --strip-components=1
                rm -f /tmp/laravel_${safeDomain}.tar.gz

                echo ">> Cấu hình tệp .env..."
                cp .env.example .env
                sed -i "s/DB_DATABASE=.*/DB_DATABASE=${dbName}/g" .env
                sed -i "s/DB_USERNAME=.*/DB_USERNAME=${dbUser}/g" .env
                sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=${dbPass}/g" .env

                echo ">> Tạo cơ sở dữ liệu MySQL..."
                mysql -e "CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                mysql -e "CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}';"
                mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'%';"
                mysql -e "FLUSH PRIVILEGES;"

                echo ">> Cài đặt Composer Dependencies..."
                if command -v composer >/dev/null; then
                    composer install --no-dev --optimize-autoloader --no-interaction
                else
                    echo ">> Composer chưa được cài đặt! Đang tải composer.phar..."
                    curl -sS https://getcomposer.org/installer | php
                    php composer.phar install --no-dev --optimize-autoloader --no-interaction
                fi

                echo ">> Khởi tạo Application Key..."
                php artisan key:generate

                echo ">> Cấu hình phân quyền storage..."
                chown -R www-data:www-data /var/www/${safeDomain}
                chmod -R 775 /var/www/${safeDomain}/storage
                chmod -R 775 /var/www/${safeDomain}/bootstrap/cache

                echo ">> Tìm socket PHP-FPM..."
                FPM_SOCK="/run/php/php${phpVersion || ''}-fpm.sock"
                if [ -z "${phpVersion || ''}" ] || [ ! -S "\$FPM_SOCK" ]; then
                    FPM_SOCK=\$(find /run/php/ -name "php*-fpm.sock" | head -1)
                    if [ -z "\$FPM_SOCK" ]; then
                        FPM_SOCK="/var/run/php/php-fpm.sock"
                    fi
                fi

                echo ">> Tạo cấu hình Nginx cho Laravel..."
                cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};
    root /var/www/${safeDomain}/public;
    index index.php index.html index.htm;

    client_max_body_size 64M;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
        fastcgi_read_timeout 300;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires max;
        log_not_found off;
        access_log off;
    }
}
EOF
                sed -i "s|FPM_SOCK_PLACEHOLDER|\$FPM_SOCK|g" /etc/nginx/sites-available/${safeDomain}

                echo ">> Kích hoạt cấu hình Nginx..."
                ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                nginx -t
                systemctl reload nginx

                ${sslCmd}

                echo ">> Laravel đã được cài đặt thành công!"
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    dbName,
                    dbUser,
                    dbPass,
                    siteUrl: (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`
                }
            });
        }

        if (appId === 'phpmyadmin') {
            const safePmaPort = parseInt(pmaPort) || 8888;
            const safePmaUser = sanitizeAlphaNum(pmaUser) || 'pma_admin';
            const safePmaPassword = pmaPassword ? pmaPassword.replace(/['"\\]/g, '') : generatePassword(12);

            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT PHPMYADMIN BẢO MẬT ==="
                
                # Kiểm tra Nginx & php-fpm
                if ! command -v nginx &> /dev/null; then
                    echo ">> Nginx chưa được cài đặt. Đang cài đặt..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
                    fi
                fi

                if ! command -v unzip &> /dev/null; then
                    echo ">> Unzip/wget chưa cài đặt. Đang cài đặt..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip wget
                    fi
                fi

                echo ">> Tải bản phpMyAdmin mới nhất..."
                mkdir -p /var/www
                cd /var/www
                if [ ! -d "/var/www/phpmyadmin" ]; then
                    wget -q https://files.phpmyadmin.net/phpMyAdmin/5.2.1/phpMyAdmin-5.2.1-all-languages.tar.gz -O /tmp/phpmyadmin.tar.gz
                    tar -xzf /tmp/phpmyadmin.tar.gz -C /var/www
                    mv /var/www/phpMyAdmin-5.2.1-all-languages /var/www/phpmyadmin
                    rm -f /tmp/phpmyadmin.tar.gz
                fi

                echo ">> Phân quyền thư mục..."
                chown -R www-data:www-data /var/www/phpmyadmin
                chmod -R 755 /var/www/phpmyadmin

                echo ">> Cấu hình Nginx Basic Auth..."
                PMA_HASH=$(openssl passwd -apr1 '${safePmaPassword}')
                echo "${safePmaUser}:\${PMA_HASH}" > /etc/nginx/.htpasswd_pma
                chmod 640 /etc/nginx/.htpasswd_pma
                chown www-data:www-data /etc/nginx/.htpasswd_pma

                echo ">> Tìm socket PHP-FPM..."
                FPM_SOCK=$(find /run/php/ -name "php*-fpm.sock" | head -1)
                if [ -z "$FPM_SOCK" ]; then
                    FPM_SOCK="/var/run/php/php-fpm.sock"
                fi

                echo ">> Tạo cấu hình Virtual Host riêng cho phpMyAdmin trên cổng ${safePmaPort}..."
                cat > /etc/nginx/sites-available/phpmyadmin << 'EOF'
server {
    listen ${safePmaPort};
    server_name _;
    root /var/www/phpmyadmin;
    index index.php index.html index.htm;

    # Basic Auth protection
    auth_basic "phpMyAdmin Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd_pma;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:FPM_SOCK_PLACEHOLDER;
        fastcgi_read_timeout 300;
    }
}
EOF
                sed -i "s|FPM_SOCK_PLACEHOLDER|\\$FPM_SOCK|g" /etc/nginx/sites-available/phpmyadmin
                ln -sf /etc/nginx/sites-available/phpmyadmin /etc/nginx/sites-enabled/

                nginx -t
                systemctl reload nginx
                echo "=== CÀI ĐẶT PHPMYADMIN BẢO MẬT HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    siteUrl: `http://${host}:${safePmaPort}`,
                    pmaUser: safePmaUser,
                    pmaPassword: safePmaPassword
                }
            });
        }

        if (appId === 'portainer') {
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT PORTAINER ==="
                # Kiểm tra docker
                if ! command -v docker &> /dev/null; then
                    echo ">> Docker chưa được cài đặt. Đang cài đặt Docker..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update
                        apt-get install -y docker.io
                    else
                        yum install -y docker
                    fi
                    systemctl start docker
                    systemctl enable docker
                fi

                if docker ps -a | grep -q portainer; then
                    echo ">> Portainer container đã tồn tại. Khởi động..."
                    docker start portainer
                else
                    echo ">> Khởi tạo volume và chạy Portainer..."
                    docker volume create portainer_data
                    docker run -d -p 9000:9000 -p 9443:9443 --name portainer --restart always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
                fi

                echo "=== CÀI ĐẶT PORTAINER HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    siteUrl: `http://${host}:9000`,
                    secureUrl: `https://${host}:9443`
                }
            });
        }

        if (appId === 'nodeapp') {
            const safeAppName = sanitizeAlphaNum(appName);
            if (!safeAppName) {
                return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
            }
            if (!gitUrl || !gitUrl.startsWith('http')) {
                return res.status(400).json({ success: false, error: 'Git Repository URL không hợp lệ' });
            }
            const safePort = parseInt(port) || 3000;

            let nginxProxyCmd = '';
            let appUrl = `http://${host}:${safePort}`;

            if (domain) {
                const safeDomain = sanitizeAlphaNum(domain);
                appUrl = (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`;
                nginxProxyCmd = `
                    echo ">> Tạo cấu hình Nginx Reverse Proxy cho Node.js App..."
                    cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                    echo ">> Kích hoạt cấu hình Nginx..."
                    ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                    nginx -t
                    systemctl reload nginx
                `;
            }

            const command = `
                set -e
                echo "=== BẮT ĐẦU AUTO-DEPLOY NODEJS APP BẢO MẬT: ${safeAppName} ==="

                # Check Git & NodeJS
                if ! command -v git &> /dev/null; then
                    echo ">> Đang cài đặt Git..."
                    if [ -f /etc/debian_version ]; then
                        apt-get update && apt-get install -y git
                    else
                        yum install -y git
                    fi
                fi

                if ! command -v node &> /dev/null; then
                    echo ">> Đang cài đặt Node.js..."
                    if [ -f /etc/debian_version ]; then
                        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                        apt-get install -y nodejs
                    else
                        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                        yum install -y nodejs
                    fi
                fi

                echo "1. Clone mã nguồn từ Git..."
                mkdir -p /var/www
                cd /var/www
                if [ -d "${safeAppName}" ]; then
                    echo "Thư mục /var/www/${safeAppName} đã tồn tại, tiến hành pull code mới..."
                    cd ${safeAppName}
                    git pull
                else
                    git clone ${gitUrl} ${safeAppName}
                    cd ${safeAppName}
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
                chown -R pm2user:pm2user /var/www/${safeAppName}

                # Tìm file chạy chính
                START_FILE="index.js"
                if [ ! -f "index.js" ] && [ -f "server.js" ]; then
                    START_FILE="server.js"
                elif [ ! -f "index.js" ] && [ ! -f "server.js" ] && [ -f "app.js" ]; then
                    START_FILE="app.js"
                fi

                # Dừng các app cũ
                pm2 stop ${safeAppName} 2>/dev/null || true
                pm2 delete ${safeAppName} 2>/dev/null || true
                sudo -u pm2user pm2 stop ${safeAppName} 2>/dev/null || true
                sudo -u pm2user pm2 delete ${safeAppName} 2>/dev/null || true

                echo "4. Khởi chạy ứng dụng bằng PM2 dưới tài khoản pm2user..."
                sudo -u pm2user env PORT=${safePort} pm2 start \${START_FILE} --name ${safeAppName} || sudo -u pm2user env PORT=${safePort} pm2 start npm --name ${safeAppName} -- start
                sudo -u pm2user pm2 save --force

                ${nginxProxyCmd}
                ${sslCmd}

                echo "=== AUTO-DEPLOY NODEJS APP HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    appName: safeAppName,
                    appUrl: appUrl
                }
            });
        }

        if (appId === 'uptime-kuma') {
            const safePort = parseInt(port) || 3001;
            let nginxProxyCmd = '';
            let appUrl = `http://${host}:${safePort}`;

            if (domain) {
                const safeDomain = sanitizeAlphaNum(domain);
                appUrl = (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`;
                nginxProxyCmd = `
                    echo ">> Tạo cấu hình Nginx Reverse Proxy cho Uptime Kuma..."
                    cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                    echo ">> Kích hoạt cấu hình Nginx..."
                    ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                    nginx -t
                    systemctl reload nginx
                `;
            }

            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT UPTIME KUMA ==="
                
                if ! command -v docker &> /dev/null; then
                    echo ">> Docker chưa được cài đặt. Đang cài đặt Docker..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && apt-get install -y docker.io
                    else
                        yum install -y docker
                    fi
                    systemctl start docker
                    systemctl enable docker
                fi

                if docker ps -a | grep -q uptime-kuma; then
                    echo ">> Container uptime-kuma đã tồn tại. Khởi động lại..."
                    docker restart uptime-kuma
                else
                    echo ">> Khởi chạy Uptime Kuma..."
                    docker run -d --name uptime-kuma -p ${safePort}:3001 --restart always -v uptime-kuma:/app/data louislam/uptime-kuma:1
                fi

                ${nginxProxyCmd}
                ${sslCmd}

                echo "=== CÀI ĐẶT UPTIME KUMA HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    siteUrl: appUrl
                }
            });
        }

        if (appId === 'ghost') {
            const safePort = parseInt(port) || 2368;
            const safeDomain = domain ? sanitizeAlphaNum(domain) : '';
            let nginxProxyCmd = '';
            let appUrl = `http://${host}:${safePort}`;

            if (safeDomain) {
                appUrl = (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`;
                nginxProxyCmd = `
                    echo ">> Tạo cấu hình Nginx Reverse Proxy cho Ghost..."
                    cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                    echo ">> Kích hoạt cấu hình Nginx..."
                    ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                    nginx -t
                    systemctl reload nginx
                `;
            }

            const ghostUrl = safeDomain ? appUrl : `http://${host}:${safePort}`;
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT GHOST ==="
                
                if ! command -v docker &> /dev/null; then
                    echo ">> Docker chưa được cài đặt. Đang cài đặt Docker..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && apt-get install -y docker.io
                    else
                        yum install -y docker
                    fi
                    systemctl start docker
                    systemctl enable docker
                fi

                if docker ps -a | grep -q ghost; then
                    echo ">> Container ghost đã tồn tại. Khởi động lại..."
                    docker restart ghost
                else
                    echo ">> Khởi chạy Ghost..."
                    docker run -d --name ghost -e url=${ghostUrl} -p ${safePort}:2368 --restart always ghost:alpine
                fi

                ${nginxProxyCmd}
                ${sslCmd}

                echo "=== CÀI ĐẶT GHOST HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    siteUrl: appUrl
                }
            });
        }

        if (appId === 'nextcloud') {
            const safePort = parseInt(port) || 8080;
            let nginxProxyCmd = '';
            let appUrl = `http://${host}:${safePort}`;

            if (domain) {
                const safeDomain = sanitizeAlphaNum(domain);
                appUrl = (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`;
                nginxProxyCmd = `
                    echo ">> Tạo cấu hình Nginx Reverse Proxy cho Nextcloud..."
                    cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};

    client_max_body_size 512M;

    location / {
        proxy_pass http://127.0.0.1:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                    echo ">> Kích hoạt cấu hình Nginx..."
                    ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                    nginx -t
                    systemctl reload nginx
                `;
            }

            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT NEXTCLOUD ==="
                
                if ! command -v docker &> /dev/null; then
                    echo ">> Docker chưa được cài đặt. Đang cài đặt Docker..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && apt-get install -y docker.io
                    else
                        yum install -y docker
                    fi
                    systemctl start docker
                    systemctl enable docker
                fi

                if docker ps -a | grep -q nextcloud; then
                    echo ">> Container nextcloud đã tồn tại. Khởi động lại..."
                    docker restart nextcloud
                else
                    echo ">> Khởi chạy Nextcloud..."
                    docker run -d --name nextcloud -p ${safePort}:80 --restart always nextcloud:apache
                fi

                ${nginxProxyCmd}
                ${sslCmd}

                echo "=== CÀI ĐẶT NEXTCLOUD HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    siteUrl: appUrl
                }
            });
        }

        if (appId === 'n8n') {
            const safePort = parseInt(port) || 5678;
            let nginxProxyCmd = '';
            let appUrl = `http://${host}:${safePort}`;

            if (domain) {
                const safeDomain = sanitizeAlphaNum(domain);
                appUrl = (ssl === true || ssl === 'true') ? `https://${safeDomain}` : `http://${safeDomain}`;
                nginxProxyCmd = `
                    echo ">> Tạo cấu hình Nginx Reverse Proxy cho n8n..."
                    cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:${safePort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
                    echo ">> Kích hoạt cấu hình Nginx..."
                    ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
                    nginx -t
                    systemctl reload nginx
                `;
            }

            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT N8N ==="
                
                if ! command -v docker &> /dev/null; then
                    echo ">> Docker chưa được cài đặt. Đang cài đặt Docker..."
                    if [ -f /etc/debian_version ]; then
                        while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                        apt-get update && apt-get install -y docker.io
                    else
                        yum install -y docker
                    fi
                    systemctl start docker
                    systemctl enable docker
                fi

                if docker ps -a | grep -q n8n; then
                    echo ">> Container n8n đã tồn tại. Khởi động lại..."
                    docker restart n8n
                else
                    echo ">> Khởi chạy n8n..."
                    docker run -d --name n8n -p ${safePort}:5678 --restart always n8nio/n8n
                fi

                ${nginxProxyCmd}
                ${sslCmd}

                echo "=== CÀI ĐẶT N8N HOÀN TẤT ==="
            `;

            return res.json({
                success: true,
                command: command.trim(),
                data: {
                    siteUrl: appUrl
                }
            });
        }

        if (appId === 'fail2ban') {
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT FAIL2BAN ==="
                if [ -f /etc/debian_version ]; then
                    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban
                else
                    yum install -y fail2ban
                fi
                systemctl enable fail2ban || true
                systemctl start fail2ban || true
                fail2ban-client --version
                echo "=== CÀI ĐẶT FAIL2BAN HOÀN TẤT ==="
            `;
            return res.json({ success: true, command: command.trim(), data: {} });
        }

        if (appId === 'pm2') {
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT PM2 ==="
                
                # Check NodeJS & NPM
                if ! command -v node &> /dev/null; then
                    echo ">> Node.js chưa được cài đặt. Đang cài đặt..."
                    if [ -f /etc/debian_version ]; then
                        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
                        apt-get install -y nodejs
                    else
                        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
                        yum install -y nodejs
                    fi
                fi
                
                npm install -g pm2
                if ! id -u pm2user &>/dev/null; then
                    useradd -m -s /bin/bash pm2user
                fi
                pm2 startup systemd -u pm2user --hp /home/pm2user || pm2 startup systemd || true
                pm2 save --force || true
                pm2 --version
                echo "=== CÀI ĐẶT PM2 HOÀN TẤT ==="
            `;
            return res.json({ success: true, command: command.trim(), data: {} });
        }

        if (appId === 'nginx') {
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT NGINX ==="
                if [ -f /etc/debian_version ]; then
                    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
                else
                    yum install -y nginx
                fi
                systemctl enable nginx || true
                systemctl start nginx || true
                nginx -v
                echo "=== CÀI ĐẶT NGINX HOÀN TẤT ==="
            `;
            return res.json({ success: true, command: command.trim(), data: {} });
        }

        if (appId === 'docker') {
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT DOCKER ==="
                if [ -f /etc/debian_version ]; then
                    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                    apt-get update && apt-get install -y ca-certificates curl gnupg
                    install -m 0755 -d /etc/apt/keyrings
                    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true
                    chmod a+r /etc/apt/keyrings/docker.gpg || true
                    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "\\$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
                    apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || apt-get install -y docker.io docker-compose
                else
                    yum install -y docker docker-compose
                fi
                systemctl start docker || true
                systemctl enable docker || true
                docker --version
                echo "=== CÀI ĐẶT DOCKER HOÀN TẤT ==="
            `;
            return res.json({ success: true, command: command.trim(), data: {} });
        }

        if (appId === 'certbot') {
            const command = `
                set -e
                echo "=== BẮT ĐẦU CÀI ĐẶT CERTBOT ==="
                if [ -f /etc/debian_version ]; then
                    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo ">> Đang chờ tiến trình apt khác giải phóng khóa hệ thống..."; sleep 3; done
                    apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
                else
                    yum install -y epel-release && yum install -y certbot python3-certbot-nginx
                fi
                certbot --version
                echo "=== CÀI ĐẶT CERTBOT HOÀN TẤT ==="
            `;
            return res.json({ success: true, command: command.trim(), data: {} });
        }

        return res.status(400).json({ success: false, error: 'Ứng dụng không hỗ trợ' });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
async function togglePhpMyAdmin(req, res) {
    try {
        const { vpsConfig, action } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        if (action === 'disable') {
            const result = await ssh.executeCommand('rm -f /etc/nginx/sites-enabled/phpmyadmin && systemctl reload nginx');
            if (result.code !== 0) {
                return res.status(500).json({ success: false, error: 'Không thể khóa phpMyAdmin', details: result.stderr || result.stdout });
            }
            return res.json({ success: true, message: 'Đã khóa truy cập phpMyAdmin (Đã gỡ cấu hình site Nginx)' });
        } else if (action === 'enable') {
            const result = await ssh.executeCommand('ln -sf /etc/nginx/sites-available/phpmyadmin /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx');
            if (result.code !== 0) {
                return res.status(500).json({ success: false, error: 'Không thể mở cổng phpMyAdmin. Có thể phpMyAdmin chưa được cài đặt.', details: result.stderr || result.stdout });
            }
            return res.json({ success: true, message: 'Đã mở truy cập phpMyAdmin' });
        } else if (action === 'status') {
            const checkEnabled = await ssh.executeCommand('[ -f /etc/nginx/sites-enabled/phpmyadmin ]');
            const checkInstalled = await ssh.executeCommand('[ -d /var/www/phpmyadmin ]');
            
            let port = null;
            if (checkInstalled.code === 0) {
                const getPort = await ssh.executeCommand("grep -oP 'listen \\s*\\K\\d+' /etc/nginx/sites-available/phpmyadmin || echo '8888'");
                port = getPort.stdout.trim();
            }

            return res.json({
                success: true,
                installed: checkInstalled.code === 0,
                enabled: checkEnabled.code === 0,
                port: port
            });
        }

        return res.status(400).json({ success: false, error: 'Hành động không hợp lệ' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    installWordPress,
    installLaravel,
    prepareInstallation,
    togglePhpMyAdmin
};

