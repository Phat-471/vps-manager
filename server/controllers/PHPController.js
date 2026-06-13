const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg } = require('../utils/security');

// Common extensions mapping
const POPULAR_EXTENSIONS = [
    { id: 'mysql', name: 'MySQL (PDO)', pkg: 'mysql', module: 'pdo_mysql', desc: 'Kết nối cơ sở dữ liệu MySQL/MariaDB.' },
    { id: 'redis', name: 'Redis', pkg: 'redis', module: 'redis', desc: 'Hỗ trợ caching hiệu năng cao trong bộ nhớ.' },
    { id: 'gd', name: 'GD Library', pkg: 'gd', module: 'gd', desc: 'Xử lý và tối ưu hóa hình ảnh (cắt, nén).' },
    { id: 'curl', name: 'Curl', pkg: 'curl', module: 'curl', desc: 'Thực thi các yêu cầu API HTTP ngoài hệ thống.' },
    { id: 'zip', name: 'Zip Archive', pkg: 'zip', module: 'zip', desc: 'Giải nén và nén tệp tin định dạng zip.' },
    { id: 'mbstring', name: 'Mbstring', pkg: 'mbstring', module: 'mbstring', desc: 'Xử lý chuỗi nhiều ký tự (multibyte/unicode).' },
    { id: 'xml', name: 'XML Parser', pkg: 'xml', module: 'xml', desc: 'Đọc và phân tích các tệp tin cấu trúc XML.' },
    { id: 'intl', name: 'Intl', pkg: 'intl', module: 'intl', desc: 'Tiện ích quốc tế hoá ngôn ngữ và tiền tệ.' },
    { id: 'imagick', name: 'ImageMagick', pkg: 'imagick', module: 'imagick', desc: 'Hỗ trợ chỉnh sửa và xử lý ảnh chất lượng cao.' },
    { id: 'opcache', name: 'OPcache', pkg: 'opcache', module: 'Zend OPcache', desc: 'Tăng tốc độ xử lý PHP bằng cách lưu mã byte đã biên dịch.' }
];

async function getPHPConfig(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const targetVersion = version ? sanitizeAlphaNum(version) : '';
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Shell script to detect PHP version, active php.ini path, and parse settings in one run
        const script = `
            VERSION="${targetVersion}"
            if [ -z "$VERSION" ]; then
                VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null)
            fi
            
            if [ -z "$VERSION" ]; then
                echo "ERROR: PHP is not installed"
                exit 1
            fi
            
            # Detect php.ini path
            INI_PATH=""
            if [ -f "/etc/php/$VERSION/fpm/php.ini" ]; then
                INI_PATH="/etc/php/$VERSION/fpm/php.ini"
            elif [ -f "/etc/php.ini" ]; then
                INI_PATH="/etc/php.ini"
            else
                INI_PATH=$(php -r "echo php_ini_loaded_file();" 2>/dev/null)
            fi

            if [ -z "$INI_PATH" ] || [ ! -f "$INI_PATH" ]; then
                echo "ERROR: php.ini not found"
                exit 1
            fi

            echo "PATH:$INI_PATH"
            echo "VERSION:$VERSION"
            echo "MEMORY_LIMIT:$(grep -E '^\s*memory_limit\s*=' $INI_PATH | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo '128M')"
            echo "UPLOAD_MAX_FILESIZE:$(grep -E '^\s*upload_max_filesize\s*=' $INI_PATH | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo '2M')"
            echo "POST_MAX_SIZE:$(grep -E '^\s*post_max_size\s*=' $INI_PATH | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo '8M')"
            echo "MAX_EXECUTION_TIME:$(grep -E '^\s*max_execution_time\s*=' $INI_PATH | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo '30')"
            echo "DISPLAY_ERRORS:$(grep -E '^\s*display_errors\s*=' $INI_PATH | head -1 | awk -F= '{print $2}' | tr -d ' ' || echo 'Off')"
        `;

        const result = await ssh.executeCommand(script);
        if (result.stdout.includes('ERROR:')) {
            return res.status(404).json({ success: false, error: result.stdout.trim() });
        }

        const lines = result.stdout.trim().split('\n');
        const config = {};
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                config[parts[0].trim()] = parts.slice(1).join(':').trim();
            }
        });

        res.json({
            success: true,
            data: config
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function savePHPConfig(req, res) {
    try {
        const { vpsConfig, path: iniPath, version, memory_limit, upload_max_filesize, post_max_size, max_execution_time, display_errors } = req.body;

        if (!iniPath) {
            return res.status(400).json({ success: false, error: 'Thiếu đường dẫn php.ini' });
        }

        // Validate values
        const memRegex = /^\d+[MGB]$/i;
        if (memory_limit && !memRegex.test(memory_limit)) {
            return res.status(400).json({ success: false, error: 'Memory limit không hợp lệ (vd: 256M, 1G)' });
        }
        if (upload_max_filesize && !memRegex.test(upload_max_filesize)) {
            return res.status(400).json({ success: false, error: 'Upload max filesize không hợp lệ (vd: 50M)' });
        }
        if (post_max_size && !memRegex.test(post_max_size)) {
            return res.status(400).json({ success: false, error: 'Post max size không hợp lệ (vd: 50M)' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const safePath = escapeShellArg(iniPath);
        const cleanVer = version ? sanitizeAlphaNum(version) : '';

        const script = `
            # Set value helper
            set_ini_val() {
                local key=$1
                local val=$2
                if grep -qE "^\\s*$key\\s*=" ${safePath}; then
                    sed -i "s|^\\s*$key\\s*=.*|$key = $val|g" ${safePath}
                else
                    echo "$key = $val" >> ${safePath}
                fi
            }

            set_ini_val "memory_limit" "${memory_limit || '128M'}"
            set_ini_val "upload_max_filesize" "${upload_max_filesize || '2M'}"
            set_ini_val "post_max_size" "${post_max_size || '8M'}"
            set_ini_val "max_execution_time" "${parseInt(max_execution_time) || 30}"
            set_ini_val "display_errors" "${display_errors === 'On' ? 'On' : 'Off'}"

            # Restart php-fpm
            VERSION="${cleanVer}"
            if [ -z "$VERSION" ]; then
                VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null)
            fi
            systemctl restart php$VERSION-fpm 2>/dev/null || systemctl restart php-fpm 2>/dev/null
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Lưu cấu hình thất bại', details: result.stderr });
        }

        res.json({ success: true, message: 'Đã lưu cấu hình php.ini và tải lại dịch vụ PHP-FPM thành công!' });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getPHPExtensions(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('php -m');
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: 'Không thể đọc danh sách module PHP', details: result.stderr });
        }

        const loadedModules = result.stdout.trim().split('\n').map(m => m.trim().toLowerCase());

        const extensions = POPULAR_EXTENSIONS.map(ext => {
            const isInstalled = loadedModules.includes(ext.module.toLowerCase());
            return {
                ...ext,
                installed: isInstalled
            };
        });

        res.json({
            success: true,
            data: extensions
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installPHPExtension(req, res) {
    try {
        const { vpsConfig, id } = req.body;
        const ext = POPULAR_EXTENSIONS.find(x => x.id === id);

        if (!ext) {
            return res.status(400).json({ success: false, error: 'Extension không hợp lệ hoặc không được hỗ trợ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            # Detect OS & Install
            VERSION=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null)
            
            if [ -f /etc/debian_version ]; then
                apt-get update
                if [ "${ext.id}" = "opcache" ]; then
                    phpenmod opcache 2>/dev/null || true
                else
                    apt-get install -y php$VERSION-${ext.pkg}
                fi
            else
                if [ "${ext.id}" = "redis" ]; then
                    yum install -y php-pecl-redis 2>/dev/null || yum install -y php-redis 2>/dev/null
                else
                    yum install -y php-${ext.pkg} 2>/dev/null
                fi
            fi

            # Restart service
            systemctl restart php$VERSION-fpm 2>/dev/null || systemctl restart php-fpm 2>/dev/null
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: `Cài đặt extension ${ext.name} thất bại`, details: result.stderr || result.stdout });
        }

        res.json({
            success: true,
            message: `Đã cài đặt và kích hoạt thành công tiện ích ${ext.name}!`
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listPHPVersions(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            DEFAULT_VER=$(php -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;" 2>/dev/null || echo "N/A")
            echo "DEFAULT:$DEFAULT_VER"
            for v in 7.4 8.0 8.1 8.2 8.3 8.4; do
                if [ -f "/usr/bin/php$v" ]; then
                    echo "INSTALLED:$v"
                fi
            done
        `;

        const result = await ssh.executeCommand(script);
        const lines = result.stdout.trim().split('\n');
        
        let defaultVersion = 'N/A';
        const installedVersions = [];

        lines.forEach(line => {
            if (line.startsWith('DEFAULT:')) {
                defaultVersion = line.replace('DEFAULT:', '').trim();
            } else if (line.startsWith('INSTALLED:')) {
                installedVersions.push(line.replace('INSTALLED:', '').trim());
            }
        });

        const allVersions = ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4'].map(v => {
            return {
                version: v,
                installed: installedVersions.includes(v),
                isDefault: defaultVersion === v
            };
        });

        res.json({
            success: true,
            data: allVersions
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installPHPVersion(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const cleanVer = sanitizeAlphaNum(version);
        
        const allowed = ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4'];
        if (!cleanVer || !allowed.includes(cleanVer)) {
            return res.status(400).json({ success: false, error: 'Phiên bản PHP không hợp lệ hoặc không được hỗ trợ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            if [ -f /etc/debian_version ]; then
                apt-get update
                apt-get install -y software-properties-common
                if ! grep -q "^deb.*ondrej/php" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
                    add-apt-repository -y ppa:ondrej/php
                    apt-get update
                fi
                DEBIAN_FRONTEND=noninteractive apt-get install -y php${cleanVer}-fpm php${cleanVer}-cli php${cleanVer}-mysql php${cleanVer}-curl php${cleanVer}-gd php${cleanVer}-mbstring php${cleanVer}-xml php${cleanVer}-zip php${cleanVer}-intl php${cleanVer}-imagick
                systemctl enable php${cleanVer}-fpm
                systemctl start php${cleanVer}-fpm
            else
                yum install -y https://rpms.remirepo.net/enterprise/remi-release-7.rpm 2>/dev/null || true
                yum-config-manager --enable remi-php$(echo ${cleanVer} | tr -d '.') 2>/dev/null || true
                yum install -y php-fpm php-mysqlnd php-cli php-gd php-curl php-mbstring php-xml php-zip php-intl php-imagick
                systemctl enable php-fpm
                systemctl start php-fpm
            fi
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0) {
            return res.status(500).json({ success: false, error: `Cài đặt PHP ${cleanVer} thất bại`, details: result.stderr || result.stdout });
        }

        res.json({ success: true, message: `Đã cài đặt thành công PHP ${cleanVer} FPM trên máy chủ!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function setDefaultPHPVersion(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const cleanVer = sanitizeAlphaNum(version);

        if (!cleanVer) {
            return res.status(400).json({ success: false, error: 'Phiên bản PHP không hợp lệ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const script = `
            if [ -f "/usr/bin/php${cleanVer}" ]; then
                update-alternatives --set php /usr/bin/php${cleanVer}
                update-alternatives --set phar /usr/bin/phar${cleanVer} 2>/dev/null || true
                echo "SUCCESS"
            else
                echo "ERROR"
                exit 1
            fi
        `;

        const result = await ssh.executeCommand(script);
        if (result.code !== 0 || result.stdout.includes('ERROR')) {
            return res.status(500).json({ success: false, error: `Không thể đặt PHP ${cleanVer} làm mặc định CLI. Vui lòng kiểm tra lại.` });
        }

        res.json({ success: true, message: `Đã cập nhật CLI mặc định sang PHP ${cleanVer} thành công!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getPHPConfig,
    savePHPConfig,
    getPHPExtensions,
    installPHPExtension,
    listPHPVersions,
    installPHPVersion,
    setDefaultPHPVersion
};
