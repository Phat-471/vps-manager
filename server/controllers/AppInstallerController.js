const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg } = require('../utils/security');
const crypto = require('crypto');

function generatePassword(length = 16) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

async function installWordPress(req, res) {
    try {
        const { vpsConfig, domain, email } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }

        const cleanDomain = safeDomain.replace(/\./g, '_');
        const dbName = `wp_${cleanDomain}`.slice(0, 32);
        const dbUser = `wp_u_${cleanDomain}`.slice(0, 16);
        const dbPass = generatePassword(16);
        const adminEmail = email || `admin@${safeDomain}`;

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
            mysql -e "CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}';"
            mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'localhost';"
            mysql -e "FLUSH PRIVILEGES;"

            echo ">> Cấu hình wp-config.php..."
            cp wp-config-sample.php wp-config.php
            sed -i "s/database_name_here/${dbName}/g" wp-config.php
            sed -i "s/username_here/${dbUser}/g" wp-config.php
            sed -i "s/password_here/${dbPass}/g" wp-config.php

            echo ">> Tải Salts bảo mật từ api.wordpress.org..."
            SALTS=$(curl -s https://api.wordpress.org/secret-key/1.1/salt/ || echo "")
            if [ -n "$SALTS" ]; then
                # Xóa các dòng salt cũ trong wp-config.php
                sed -i '/AUTH_KEY/,/NONCE_SALT/d' wp-config.php
                # Chèn salts mới
                echo "$SALTS" >> wp-config.php
            fi

            echo ">> Phân quyền thư mục..."
            chown -R www-data:www-data /var/www/${safeDomain}
            find /var/www/${safeDomain} -type d -exec chmod 755 {} \\;
            find /var/www/${safeDomain} -type f -exec chmod 644 {} \\;

            echo ">> Tạo cấu hình Nginx..."
            cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};
    root /var/www/${safeDomain};
    index index.php index.html index.htm;

    client_max_body_size 64M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
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

            echo ">> Kích hoạt cấu hình Nginx..."
            ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
            nginx -t
            systemctl reload nginx
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
                adminEmail,
                siteUrl: `http://${safeDomain}`
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installLaravel(req, res) {
    try {
        const { vpsConfig, domain } = req.body;
        const safeDomain = sanitizeAlphaNum(domain);
        if (!safeDomain) {
            return res.status(400).json({ success: false, error: 'Domain không hợp lệ' });
        }

        const cleanDomain = safeDomain.replace(/\./g, '_');
        const dbName = `la_${cleanDomain}`.slice(0, 32);
        const dbUser = `la_u_${cleanDomain}`.slice(0, 16);
        const dbPass = generatePassword(16);

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
            mysql -e "CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}';"
            mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'localhost';"
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

            echo ">> Tạo cấu hình Nginx cho Laravel..."
            cat > /etc/nginx/sites-available/${safeDomain} << 'EOF'
server {
    listen 80;
    server_name ${safeDomain} *.${safeDomain};
    root /var/www/${safeDomain}/public;
    index index.php index.html index.htm;

    client_max_body_size 64M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
        fastcgi_read_timeout 300;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires max;
        log_not_found off;
        access_log off;
    }
}
EOF

            echo ">> Kích hoạt cấu hình Nginx..."
            ln -sf /etc/nginx/sites-available/${safeDomain} /etc/nginx/sites-enabled/
            nginx -t
            systemctl reload nginx
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
                siteUrl: `http://${safeDomain}`
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    installWordPress,
    installLaravel
};
