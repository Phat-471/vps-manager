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
            { name: 'go', command: 'go version 2>&1 | head -1' },
            { name: 'rsync', command: 'rsync --version | head -1' },
            { name: 'ufw', command: 'ufw --version | head -1' },
            { name: 'supervisord', command: 'supervisord -v 2>&1' },
            { name: 'rclone', command: 'rclone --version | head -1' },
            { name: 'netdata', command: 'netdata -V 2>&1' },
            { name: 'vsftpd', command: 'vsftpd -v 2>&1 | head -1' },
            { name: 'phpmyadmin', command: 'test -d /usr/share/phpmyadmin && echo "installed"', skipWhich: true },
            { name: 'portainer', command: 'docker ps -a --filter name=portainer --format "{{.Names}}" 2>&1', skipWhich: true },
            { name: 'memcached', command: 'memcached -h 2>&1 | head -1' },
            { name: 'postfix', command: 'postconf -d mail_version 2>&1 | head -1' }
        ];

        // Check all software in parallel
        for (const check of checks) {
            try {
                const cmdStr = check.skipWhich ? check.command : `which ${check.name} && ${check.command}`;
                const result = await ssh.executeCommand(cmdStr);
                if (result.stdout && !result.stdout.includes('not found') && result.stdout.trim() !== '') {
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
            golang: installed.go?.installed,
            rsync: installed.rsync?.installed,
            ufw: installed.ufw?.installed,
            supervisor: installed.supervisord?.installed,
            rclone: installed.rclone?.installed,
            netdata: installed.netdata?.installed,
            vsftpd: installed.vsftpd?.installed,
            phpmyadmin: installed.phpmyadmin?.installed,
            portainer: installed.portainer?.installed,
            memcached: installed.memcached?.installed,
            postfix: installed.postfix?.installed
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

async function installRsync(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y rsync
            rsync --version | head -1
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Rsync thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installUFW(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
            ufw --version | head -1
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt UFW Firewall thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installSupervisor(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y supervisor
            systemctl enable supervisor
            systemctl start supervisor
            supervisord -v
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Supervisor thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installRclone(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            curl https://rclone.org/install.sh | bash
            rclone --version | head -1
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Rclone thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installNetdata(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
            sh /tmp/netdata-kickstart.sh --non-interactive
            netdata -V
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Netdata thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function uninstallSoftware(req, res) {
    try {
        const { vpsConfig, softwareId } = req.body;
        if (!softwareId) {
            return res.status(400).json({ success: false, error: 'Thiếu định danh phần mềm cần gỡ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const uninstallCmds = {
            nginx: 'apt-get purge -y nginx nginx-common nginx-core && apt-get autoremove -y',
            mysql: 'apt-get purge -y mysql-server mysql-client mysql-common && apt-get autoremove -y',
            php: 'apt-get purge -y php-fpm php-cli php-common php-mysql php-curl php-gd php-mbstring php-xml php-zip php-bcmath php-soap php-intl php-readline && apt-get autoremove -y',
            nodejs: 'apt-get purge -y nodejs && apt-get autoremove -y && rm -rf $HOME/.nvm /root/.nvm',
            docker: 'apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && apt-get autoremove -y',
            java: 'apt-get purge -y openjdk-17-jdk openjdk-17-jre && apt-get autoremove -y',
            mongodb: 'apt-get purge -y mongodb-org mongodb-org-server mongodb-org-shell mongodb-org-mongos mongodb-org-tools && apt-get autoremove -y',
            redis: 'apt-get purge -y redis-server redis-tools && apt-get autoremove -y',
            golang: 'apt-get purge -y golang-go && apt-get autoremove -y',
            fail2ban: 'apt-get purge -y fail2ban && apt-get autoremove -y',
            certbot: 'apt-get purge -y certbot python3-certbot-nginx && apt-get autoremove -y',
            composer: 'rm -f /usr/local/bin/composer',
            apache: 'apt-get purge -y apache2 && apt-get autoremove -y',
            lemp: 'apt-get purge -y nginx nginx-common nginx-core mysql-server mysql-client mysql-common php-fpm php-cli php-common php-mysql && apt-get autoremove -y',
            rsync: 'apt-get purge -y rsync && apt-get autoremove -y',
            ufw: 'apt-get purge -y ufw && apt-get autoremove -y',
            supervisor: 'apt-get purge -y supervisor && apt-get autoremove -y',
            rclone: 'rm -f /usr/bin/rclone /usr/local/bin/rclone /usr/share/man/man1/rclone.1',
            netdata: 'wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh && sh /tmp/netdata-kickstart.sh --uninstall --non-interactive || apt-get purge -y netdata',
            vsftpd: 'apt-get purge -y vsftpd && apt-get autoremove -y',
            phpmyadmin: 'apt-get purge -y phpmyadmin && rm -rf /usr/share/phpmyadmin /var/www/html/phpmyadmin && apt-get autoremove -y',
            portainer: 'docker stop portainer && docker rm portainer && docker volume rm portainer_data',
            memcached: 'apt-get purge -y memcached && apt-get autoremove -y',
            postfix: 'apt-get purge -y postfix && apt-get autoremove -y'
        };

        const cmd = uninstallCmds[softwareId];
        if (!cmd) {
            return res.status(400).json({ success: false, error: `Không hỗ trợ gỡ cài đặt phần mềm này: ${softwareId}` });
        }

        const result = await ssh.executeCommand(cmd);

        res.json({
            success: true,
            message: `Đã gỡ cài đặt ${softwareId} thành công`,
            output: result.stdout || result.stderr
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installVsftpd(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y vsftpd
            systemctl enable vsftpd
            systemctl start vsftpd
            vsftpd -v 2>&1 | head -1
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt vsftpd FTP Server thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installPhpMyAdmin(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            echo "phpmyadmin phpmyadmin/dbconfig-install boolean false" | debconf-set-selections
            echo "phpmyadmin phpmyadmin/reconfigure-webconfig select nginx" | debconf-set-selections
            DEBIAN_FRONTEND=noninteractive apt-get install -y phpmyadmin
            ln -sf /usr/share/phpmyadmin /var/www/html/phpmyadmin
            echo "phpMyAdmin installed to /var/www/html/phpmyadmin"
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt phpMyAdmin thành công (Truy cập tại http://<IP_VPS>/phpmyadmin)', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installPortainer(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            docker volume create portainer_data
            docker run -d -p 9000:9000 --name portainer --restart=always -v /var/run/docker.sock:/var/run/docker.sock -v portainer_data:/data portainer/portainer-ce:latest
            docker ps | grep portainer
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Portainer thành công (Truy cập cổng :9000)', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installMemcached(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            DEBIAN_FRONTEND=noninteractive apt-get install -y memcached libmemcached-tools
            systemctl enable memcached
            systemctl start memcached
            memcached -h | head -1
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Memcached thành công', output: result.stdout });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function installPostfix(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const cmd = `
            apt-get update
            echo "postfix postfix/mailname string localhost" | debconf-set-selections
            echo "postfix postfix/main_mailer_type select 'Local only'" | debconf-set-selections
            DEBIAN_FRONTEND=noninteractive apt-get install -y postfix
            systemctl enable postfix
            systemctl start postfix
            postconf -d mail_version
        `;
        const result = await ssh.executeCommand(cmd);
        res.json({ success: true, message: 'Đã cài đặt Postfix Mail Server thành công', output: result.stdout });
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
    installGolang,
    installRsync,
    installUFW,
    installSupervisor,
    installRclone,
    installNetdata,
    installVsftpd,
    installPhpMyAdmin,
    installPortainer,
    installMemcached,
    installPostfix,
    uninstallSoftware
};
