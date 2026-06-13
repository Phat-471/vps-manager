const { connectionPool } = require('../utils/ssh');
const { escapeShellArg, sanitizeAppName, sanitizeNumber } = require('../utils/security');

/**
 * List PM2 applications
 */
async function listApplications(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Check if PM2 is installed
        const pm2Check = await ssh.executeCommand('which pm2');
        if (!pm2Check.stdout) {
            return res.json({
                success: true,
                data: {
                    apps: [],
                    hasPM2: false,
                    message: 'PM2 chưa được cài đặt'
                }
            });
        }

        // Get PM2 app list as JSON
        const result = await ssh.executeCommand('pm2 jlist');

        if (result.stdout) {
            const apps = JSON.parse(result.stdout);

            res.json({
                success: true,
                data: {
                    apps: apps.map(app => {
                        // Extract port from environment variables or args
                        let port = null;
                        if (app.pm2_env.env && app.pm2_env.env.PORT) {
                            port = app.pm2_env.env.PORT;
                        }
                        // Fallback: try to extract from pm_exec_path by reading file
                        // For now, we'll rely on env vars set during creation

                        return {
                            name: app.name,
                            pm_id: app.pm_id,
                            status: app.pm2_env.status,
                            cpu: app.monit.cpu,
                            memory: app.monit.memory,
                            uptime: app.pm2_env.pm_uptime,
                            restarts: app.pm2_env.restart_time,
                            script: app.pm2_env.pm_exec_path,
                            path: app.pm2_env.pm_cwd || app.pm2_env.cwd,
                            port: port
                        };
                    }),
                    hasPM2: true
                }
            });
        } else {
            res.json({
                success: true,
                data: {
                    apps: [],
                    hasPM2: true
                }
            });
        }

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Start PM2 application
 */
async function startApplication(req, res) {
    try {
        const { vpsConfig, appName } = req.body;
        const safeAppName = sanitizeAppName(appName);
        if (!safeAppName) {
            return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`pm2 start ${escapeShellArg(safeAppName)}`);

        res.json({
            success: true,
            message: `Đã khởi động ứng dụng ${safeAppName}`,
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
 * Stop PM2 application
 */
async function stopApplication(req, res) {
    try {
        const { vpsConfig, appName } = req.body;
        const safeAppName = sanitizeAppName(appName);
        if (!safeAppName) {
            return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`pm2 stop ${escapeShellArg(safeAppName)}`);

        res.json({
            success: true,
            message: `Đã dừng ứng dụng ${safeAppName}`,
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
 * Restart PM2 application
 */
async function restartApplication(req, res) {
    try {
        const { vpsConfig, appName } = req.body;
        const safeAppName = sanitizeAppName(appName);
        if (!safeAppName) {
            return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`pm2 restart ${escapeShellArg(safeAppName)}`);

        res.json({
            success: true,
            message: `Đã khởi động lại ứng dụng ${safeAppName}`,
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
 * Delete PM2 application
 */
async function deleteApplication(req, res) {
    try {
        const { vpsConfig, appName } = req.body;
        const safeAppName = sanitizeAppName(appName);
        if (!safeAppName) {
            return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`pm2 delete ${escapeShellArg(safeAppName)}`);

        res.json({
            success: true,
            message: `Đã xóa ứng dụng ${safeAppName}`,
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
 * Get PM2 application logs
 */
async function getApplicationLogs(req, res) {
    try {
        const { vpsConfig, appName, lines } = req.body;
        const safeAppName = sanitizeAppName(appName);
        if (!safeAppName) {
            return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
        }
        const numLines = sanitizeNumber(lines) || 100;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand(`pm2 logs ${escapeShellArg(safeAppName)} --lines ${numLines} --nostream`);

        res.json({
            success: true,
            data: {
                logs: result.stdout
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Create app via wizard - beginner friendly
 */
async function createAppWizard(req, res) {
    try {
        const { vpsConfig, appName, port, template, description } = req.body;

        // Validate inputs
        if (!appName || !port || !template) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin: appName, port, template'
            });
        }

        // Sanitize app name
        const sanitizedAppName = appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const appPath = `/var/www/apps/${sanitizedAppName}`;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Step 1: Create directory
        await ssh.executeCommand(`mkdir -p ${escapeShellArg(appPath)}`);

        // Step 2: Generate files based on template
        const templates = {
            'express-api': {
                serverJs: `const express = require('express');
const app = express();
const PORT = ${portNum};

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    app: '${sanitizedAppName}',
    description: '${(description || 'API Server').replace(/'/g, "\\'")}',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.post('/echo', (req, res) => {
  res.json({ echo: req.body });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`${sanitizedAppName} running on port \${PORT}\`);
});`,
                packageJson: {
                    name: sanitizedAppName,
                    version: '1.0.0',
                    description: description || 'Express API Server',
                    main: 'server.js',
                    scripts: {
                        start: 'node server.js'
                    },
                    dependencies: {
                        express: '^4.18.0'
                    }
                }
            },
            'web-dashboard': {
                serverJs: `const express = require('express');
const app = express();
const PORT = ${portNum};

app.get('/', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${sanitizedAppName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        h1 { font-size: 3em; margin-bottom: 20px; }
        p { font-size: 1.2em; margin: 10px 0; }
        .stats { margin-top: 30px; }
        .stat { display: inline-block; margin: 0 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 ${sanitizedAppName}</h1>
        <p>${(description || 'Web Dashboard').replace(/'/g, "\\'")}</p>
        <div class="stats">
          <div class="stat">
            <p>Port: <strong>${portNum}</strong></p>
          </div>
          <div class="stat">
            <p>Status: <strong>Online</strong></p>
          </div>
        </div>
        <p style="margin-top: 30px; opacity: 0.7;">Deployed with PM2</p>
      </div>
    </body>
    </html>
  \`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`${sanitizedAppName} running on port \${PORT}\`);
});`,
                packageJson: {
                    name: sanitizedAppName,
                    version: '1.0.0',
                    description: description || 'Web Dashboard',
                    main: 'server.js',
                    dependencies: {
                        express: '^4.18.0'
                    }
                }
            },
            'static-site': {
                serverJs: `const express = require('express');
const path = require('path');
const app = express();
const PORT = ${portNum};

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`${sanitizedAppName} running on port \${PORT}\`);
});`,
                packageJson: {
                    name: sanitizedAppName,
                    version: '1.0.0',
                    description: description || 'Static Website',
                    main: 'server.js',
                    dependencies: {
                        express: '^4.18.0'
                    }
                },
                indexHtml: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sanitizedAppName}</title>
  <style>
    body { font-family: Arial; text-align: center; padding: 50px; }
    h1 { color: #4CAF50; }
  </style>
</head>
<body>
  <h1>${sanitizedAppName}</h1>
  <p>${(description || 'Static Website').replace(/'/g, "\\'")}</p>
  <p>Edit files in public/ folder</p>
</body>
</html>`
            },
            'custom': {
                serverJs: `const express = require('express');
const app = express();
const PORT = ${portNum};

app.use(express.json());

// Add your routes here
app.get('/', (req, res) => {
  res.json({ message: 'Custom app - edit server.js to add features' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
                packageJson: {
                    name: sanitizedAppName,
                    version: '1.0.0',
                    description: description || 'Custom Application',
                    main: 'server.js',
                    dependencies: {
                        express: '^4.18.0'
                    }
                }
            }
        };

        const selectedTemplate = templates[template];
        if (!selectedTemplate) {
            return res.status(400).json({
                success: false,
                error: 'Template không hợp lệ'
            });
        }

        // Create server.js
        const serverJsContent = selectedTemplate.serverJs.replace(/\$/g, '\\$');
        await ssh.executeCommand(`cat > ${escapeShellArg(`${appPath}/server.js`)} << 'ENDOFFILE'
${serverJsContent}
ENDOFFILE`);

        // Create package.json
        await ssh.executeCommand(`cat > ${escapeShellArg(`${appPath}/package.json`)} << 'ENDOFFILE'
${JSON.stringify(selectedTemplate.packageJson, null, 2)}
ENDOFFILE`);

        // Create public/index.html for static site
        if (template === 'static-site') {
            await ssh.executeCommand(`mkdir -p ${escapeShellArg(`${appPath}/public`)}`);
            await ssh.executeCommand(`cat > ${escapeShellArg(`${appPath}/public/index.html`)} << 'ENDOFFILE'
${selectedTemplate.indexHtml}
ENDOFFILE`);
        }

        // Step 3: Install dependencies
        await ssh.executeCommand(`cd ${escapeShellArg(appPath)} && npm install --production`);

        // Step 4: Deploy with PM2 (set PORT env var for easy retrieval)
        await ssh.executeCommand(`cd ${escapeShellArg(appPath)} && PORT=${portNum} pm2 start server.js --name ${escapeShellArg(sanitizedAppName)} --update-env`);
        await ssh.executeCommand(`pm2 save`);

        res.json({
            success: true,
            message: `Ứng dụng ${sanitizedAppName} đã được tạo và deploy thành công!`,
            data: {
                appName: sanitizedAppName,
                port: portNum,
                path: appPath,
                url: `http://${vpsConfig.host}:${portNum}`,
                template: template
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * List all ports currently in use by PM2 apps
 */
async function listUsedPorts(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Check if PM2 is installed
        const pm2Check = await ssh.executeCommand('which pm2');
        if (!pm2Check.stdout) {
            return res.json({
                success: true,
                data: {
                    usedPorts: [],
                    apps: [],
                    hasPM2: false
                }
            });
        }

        // Get PM2 app list as JSON
        const result = await ssh.executeCommand('pm2 jlist');

        if (result.stdout) {
            const apps = JSON.parse(result.stdout);
            const usedPorts = [];
            const appDetails = [];

            apps.forEach(app => {
                // Extract port from environment variables
                let port = null;
                if (app.pm2_env.env && app.pm2_env.env.PORT) {
                    port = parseInt(app.pm2_env.env.PORT);
                }

                if (port) {
                    usedPorts.push(port);
                    appDetails.push({
                        name: app.name,
                        port: port,
                        status: app.pm2_env.status
                    });
                }
            });

            res.json({
                success: true,
                data: {
                    usedPorts: usedPorts,
                    apps: appDetails,
                    hasPM2: true
                }
            });
        } else {
            res.json({
                success: true,
                data: {
                    usedPorts: [],
                    apps: [],
                    hasPM2: true
                }
            });
        }

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Check if a specific port is available
 */
async function checkPortAvailability(req, res) {
    try {
        const { vpsConfig, port } = req.body;

        if (!port) {
            return res.status(400).json({
                success: false,
                error: 'Port is required'
            });
        }

        const portNum = parseInt(port);

        // Validate port range
        if (portNum < 1024 || portNum > 65535) {
            return res.json({
                success: true,
                data: {
                    available: false,
                    reason: 'Port phải từ 1024 đến 65535'
                }
            });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Check if PM2 is installed
        const pm2Check = await ssh.executeCommand('which pm2');
        if (!pm2Check.stdout) {
            // No PM2, check system ports
            const netstatResult = await ssh.executeCommand(`netstat -tuln | grep :${portNum} || echo "available"`);
            const isAvailable = netstatResult.stdout.includes('available');

            return res.json({
                success: true,
                data: {
                    available: isAvailable,
                    usedBy: isAvailable ? null : 'system process'
                }
            });
        }

        // Get PM2 apps
        const result = await ssh.executeCommand('pm2 jlist');

        if (result.stdout) {
            const apps = JSON.parse(result.stdout);

            // Check if any app is using this port
            for (const app of apps) {
                if (app.pm2_env.env && app.pm2_env.env.PORT) {
                    const appPort = parseInt(app.pm2_env.env.PORT);
                    if (appPort === portNum) {
                        return res.json({
                            success: true,
                            data: {
                                available: false,
                                usedBy: app.name,
                                status: app.pm2_env.status
                            }
                        });
                    }
                }
            }
        }

        // Also check system ports
        const netstatResult = await ssh.executeCommand(`netstat -tuln | grep :${portNum} || echo "available"`);
        const isAvailable = netstatResult.stdout.includes('available');

        res.json({
            success: true,
            data: {
                available: isAvailable,
                usedBy: isAvailable ? null : 'system process'
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Get environment variables from .env file
 */
async function getEnvVariables(req, res) {
    try {
        const { vpsConfig, appPath } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const envFilePath = `${appPath}/.env`;

        // Check if file exists
        const checkResult = await ssh.executeCommand(`test -f ${escapeShellArg(envFilePath)} && echo "exists" || echo "notfound"`);

        if (checkResult.stdout.trim() === 'notfound') {
            return res.json({
                success: true,
                data: {
                    env: {},
                    exists: false
                }
            });
        }

        // Read file
        const readResult = await ssh.executeCommand(`cat ${escapeShellArg(envFilePath)}`);
        const content = readResult.stdout;

        // Parse .env content
        const env = {};
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const parts = trimmedLine.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim();
                    // Remove quotes if present
                    let val = value;
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.substring(1, val.length - 1);
                    }
                    env[key] = val;
                }
            }
        });

        res.json({
            success: true,
            data: {
                env: env,
                exists: true
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

/**
 * Save environment variables to .env file and restart app
 */
async function saveEnvVariables(req, res) {
    try {
        const { vpsConfig, appPath, appName, env } = req.body;
        const safeAppName = sanitizeAppName(appName);
        if (!safeAppName) {
            return res.status(400).json({ success: false, error: 'Tên ứng dụng không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const envFilePath = `${appPath}/.env`;

        // Convert object to .env format
        let content = '';
        for (const [key, value] of Object.entries(env)) {
            // Basic sanitization for keys and values
            const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '');
            if (cleanKey) {
                content += `${cleanKey}=${value}\n`;
            }
        }

        // Write to file
        const escapedContent = content.replace(/\$/g, '\\$');
        await ssh.executeCommand(`cat > ${escapeShellArg(envFilePath)} << 'EOF'\n${escapedContent}EOF`);

        // Restart app to apply changes
        await ssh.executeCommand(`pm2 restart ${escapeShellArg(safeAppName)}`);
        await ssh.executeCommand(`pm2 save`);

        res.json({
            success: true,
            message: 'Đã lưu cấu hình và khởi động lại ứng dụng'
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

module.exports = {
    listApplications,
    startApplication,
    stopApplication,
    restartApplication,
    deleteApplication,
    getApplicationLogs,
    createAppWizard,
    listUsedPorts,
    checkPortAvailability,
    getEnvVariables,
    saveEnvVariables
};
