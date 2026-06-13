const { connectionPool } = require('../utils/ssh');

/**
 * Detect OS type
 */
async function detectOS(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Detect OS
        const osRelease = await ssh.executeCommand('cat /etc/os-release');
        const osType = detectOSType(osRelease.stdout);

        res.json({
            success: true,
            data: {
                osType,
                packageManager: getPackageManager(osType)
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

function detectOSType(osRelease) {
    if (osRelease.includes('Ubuntu') || osRelease.includes('Debian')) {
        return 'debian';
    } else if (osRelease.includes('CentOS') || osRelease.includes('Red Hat') || osRelease.includes('Fedora')) {
        return 'redhat';
    }
    return 'unknown';
}

function getPackageManager(osType) {
    switch (osType) {
        case 'debian':
            return 'apt';
        case 'redhat':
            return 'yum';
        default:
            return 'unknown';
    }
}

/**
 * Install package
 */
async function installPackage(req, res) {
    try {
        const { vpsConfig, packages } = req.body;

        if (!packages || packages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Không có package nào được chọn'
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Detect OS and package manager
        const osRelease = await ssh.executeCommand('cat /etc/os-release');
        const osType = detectOSType(osRelease.stdout);
        const packageManager = getPackageManager(osType);

        let installCmd;
        if (packageManager === 'apt') {
            installCmd = `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages.join(' ')}`;
        } else if (packageManager === 'yum') {
            installCmd = `yum install -y ${packages.join(' ')}`;
        } else {
            return res.status(400).json({
                success: false,
                error: 'Không hỗ trợ package manager này'
            });
        }

        const result = await ssh.executeCommand(installCmd);

        res.json({
            success: true,
            message: 'Cài đặt thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Update system packages
 */
async function updateSystem(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Detect OS
        const osRelease = await ssh.executeCommand('cat /etc/os-release');
        const osType = detectOSType(osRelease.stdout);
        const packageManager = getPackageManager(osType);

        let updateCmd;
        if (packageManager === 'apt') {
            updateCmd = 'apt-get update && apt-get upgrade -y';
        } else if (packageManager === 'yum') {
            updateCmd = 'yum update -y';
        } else {
            return res.status(400).json({
                success: false,
                error: 'Không hỗ trợ package manager này'
            });
        }

        const result = await ssh.executeCommand(updateCmd);

        res.json({
            success: true,
            message: 'Cập nhật hệ thống thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install LEMP stack
 */
async function installLEMP(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const osRelease = await ssh.executeCommand('cat /etc/os-release');
        const osType = detectOSType(osRelease.stdout);

        if (osType !== 'debian') {
            return res.status(400).json({
                success: false,
                error: 'LEMP stack chỉ hỗ trợ Ubuntu/Debian'
            });
        }

        // Install LEMP
        const commands = `
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y nginx mysql-server php-fpm php-mysql
      systemctl enable nginx
      systemctl enable mysql
      systemctl start nginx
      systemctl start mysql
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt LEMP stack thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Node.js
 */
async function installNodeJS(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const nodeVersion = version || '18';

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      curl -fsSL https://deb.nodesource.com/setup_${nodeVersion}.x | bash -
      apt-get install -y nodejs
      node --version
      npm --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt Node.js thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Docker
 */
async function installDocker(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      apt-get update
      apt-get install -y ca-certificates curl gnupg
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      apt-get update
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      systemctl enable docker
      systemctl start docker
      docker --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt Docker thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Python với pip
 */
async function installPython(req, res) {
    try {
        const { vpsConfig, version } = req.body;
        const pythonVersion = version || '3';

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y python${pythonVersion} python${pythonVersion}-pip python${pythonVersion}-venv
      python${pythonVersion} --version
      pip${pythonVersion} --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: `Đã cài đặt Python ${pythonVersion} thành công`,
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Redis
 */
async function installRedis(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server
      systemctl enable redis-server
      systemctl start redis-server
      redis-cli --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt Redis thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install MongoDB
 */
async function installMongoDB(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
      echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org
      systemctl enable mongod
      systemctl start mongod
      mongod --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt MongoDB thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install PostgreSQL
 */
async function installPostgreSQL(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
      systemctl enable postgresql
      systemctl start postgresql
      psql --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt PostgreSQL thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install PM2
 */
async function installPM2(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
            # Install PM2 globally
            npm install -g pm2
            
            # Create a dedicated low-privilege user for running Node.js apps
            if ! id -u pm2user &>/dev/null; then
                useradd -m -s /bin/bash pm2user
            fi
            
            # Configure startup services
            pm2 startup systemd 2>/dev/null || true
            
            # Print status
            pm2 --version
        `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt PM2 và cấu hình tài khoản bảo mật pm2user thành công!',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Git
 */
async function installGit(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y git
      git --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt Git thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Certbot (Let's Encrypt SSL)
 */
async function installCertbot(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
      certbot --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt Certbot thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Install Composer (PHP)
 */
async function installComposer(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const commands = `
      curl -sS https://getcomposer.org/installer | php
      mv composer.phar /usr/local/bin/composer
      chmod +x /usr/local/bin/composer
      composer --version
    `;

        const result = await ssh.executeCommand(commands);

        res.json({
            success: true,
            message: 'Đã cài đặt Composer thành công',
            output: result.stdout
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Get list of installed software
 */
async function getInstalledSoftware(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const installed = {};

        // Check each software
        const checks = [
            { name: 'nginx', command: 'nginx -v 2>&1 | head -1' },
            { name: 'mysql', command: 'mysql --version 2>&1 | head -1' },
            { name: 'php', command: 'php -v 2>&1 | head -1' },
            { name: 'node', command: 'node --version 2>&1' },
            { name: 'docker', command: 'docker --version 2>&1' },
            { name: 'python3', command: 'python3 --version 2>&1' },
            { name: 'redis', command: 'redis-cli --version 2>&1' },
            { name: 'mongod', command: 'mongod --version 2>&1 | head -1' },
            { name: 'psql', command: 'psql --version 2>&1' },
            { name: 'pm2', command: 'pm2 --version 2>&1' },
            { name: 'git', command: 'git --version 2>&1' },
            { name: 'certbot', command: 'certbot --version 2>&1' },
            { name: 'composer', command: 'composer --version 2>&1 | head -1' },
            { name: 'java', command: 'java -version 2>&1 | head -1' },
            { name: 'apache2', command: 'apache2 -v 2>&1 | head -1' },
            { name: 'fail2ban-client', command: 'fail2ban-client --version 2>&1 | head -1' },
            { name: 'go', command: 'go version 2>&1 | head -1' }
        ];

        // Check all software in parallel
        for (const check of checks) {
            try {
                const result = await ssh.executeCommand(`which ${check.name} && ${check.command}`);
                if (result.stdout && !result.stdout.includes('not found')) {
                    installed[check.name] = {
                        installed: true,
                        version: result.stdout.trim()
                    };
                } else {
                    installed[check.name] = {
                        installed: false,
                        version: null
                    };
                }
            } catch (err) {
                installed[check.name] = {
                    installed: false,
                    version: null
                };
            }
        }

        // Map to software categories
        const softwareStatus = {
            lemp: installed.nginx?.installed && installed.mysql?.installed && installed.php?.installed,
            nginx: installed.nginx?.installed,
            mysql: installed.mysql?.installed,
            php: installed.php?.installed,
            nodejs: installed.node?.installed,
            docker: installed.docker?.installed,
            python: installed.python3?.installed,
            redis: installed.redis?.installed,
            mongodb: installed.mongod?.installed,
            postgresql: installed.psql?.installed,
            pm2: installed.pm2?.installed,
            git: installed.git?.installed,
            certbot: installed.certbot?.installed,
            composer: installed.composer?.installed,
            java: installed.java?.installed,
            apache: installed.apache2?.installed,
            fail2ban: installed['fail2ban-client']?.installed,
            golang: installed.go?.installed
        };

        res.json({
            success: true,
            data: {
                installed,
                softwareStatus
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function installNginx(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
            systemctl enable nginx
            systemctl start nginx
            nginx -v
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Nginx thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installMySQL(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
            systemctl enable mysql
            systemctl start mysql
            mysql --version
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt MySQL Server thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installPHP(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y php-fpm php-mysql php-cli php-common php-curl php-gd php-mbstring php-xml
            FPM_SERVICE=$(systemctl list-units --type=service --all | grep php | grep fpm | awk '{print $1}' | head -1)
            if [ -n "$FPM_SERVICE" ]; then
                systemctl enable $FPM_SERVICE
                systemctl start $FPM_SERVICE
            fi
            php -v
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt PHP-FPM thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installJava(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jdk openjdk-17-jre
            java -version
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Java OpenJDK 17 thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installApache(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y apache2
            systemctl enable apache2
            systemctl start apache2
            apache2 -v
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Apache Web Server thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installFail2Ban(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban
            systemctl enable fail2ban
            systemctl start fail2ban
            fail2ban-client --version
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Fail2Ban thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installGolang(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y golang-go
            go version
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Golang thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    detectOS,
    installPackage,
    updateSystem,
    installLEMP,
    installNodeJS,
    installDocker,
    installPython,
    installRedis,
    installMongoDB,
    installPostgreSQL,
    installPM2,
    installGit,
    installCertbot,
    installComposer,
    getInstalledSoftware,
    installNginx,
    installMySQL,
    installPHP,
    installJava,
    installApache,
    installFail2Ban,
    installGolang
};
