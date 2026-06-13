const { connectionPool } = require('../utils/ssh');
const { sanitizeAlphaNum, escapeShellArg } = require('../utils/security');

async function listDatabases(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand("mysql -e 'SHOW DATABASES;' -sN");
        const databases = result.stdout.trim().split('\n').filter(db =>
            !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db)
        );

        res.json({ success: true, data: databases });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function listUsers(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand("mysql -e \"SELECT User, Host FROM mysql.user;\" -sN");
        const users = result.stdout.trim().split('\n').map(line => {
            const [user, host] = line.split('\t');
            return { user, host };
        }).filter(u => !['root', 'mysql.session', 'mysql.sys', 'mysql.infoschema', 'debian-sys-maint'].includes(u.user));

        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function addDatabase(req, res) {
    try {
        const { vpsConfig, name } = req.body;
        const safeName = sanitizeAlphaNum(name);
        if (!safeName) {
            return res.status(400).json({ success: false, error: 'Tên Database không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`mysql -e 'CREATE DATABASE \`${safeName}\`;'`);
        res.json({ success: true, message: 'Database created' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function addUser(req, res) {
    try {
        const { vpsConfig, user, pass } = req.body;
        const safeUser = sanitizeAlphaNum(user);
        if (!safeUser) {
            return res.status(400).json({ success: false, error: 'Username không hợp lệ' });
        }
        const escapedPass = String(pass || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const sql = `CREATE USER '${safeUser}'@'%' IDENTIFIED BY '${escapedPass}'; GRANT ALL PRIVILEGES ON *.* TO '${safeUser}'@'%'; FLUSH PRIVILEGES;`;
        
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`mysql -e ${escapeShellArg(sql)}`);
        res.json({ success: true, message: 'User created' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteDatabase(req, res) {
    try {
        const { vpsConfig, name } = req.body;
        const safeName = sanitizeAlphaNum(name);
        if (!safeName) {
            return res.status(400).json({ success: false, error: 'Tên Database không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`mysql -e 'DROP DATABASE \`${safeName}\`;'`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function deleteUser(req, res) {
    try {
        const { vpsConfig, user, host } = req.body;
        const safeUser = sanitizeAlphaNum(user);
        const safeHost = sanitizeAlphaNum(host) || '%';
        if (!safeUser) {
            return res.status(400).json({ success: false, error: 'Username không hợp lệ' });
        }
        if (['root', 'mysql.session', 'mysql.sys', 'mysql.infoschema', 'debian-sys-maint'].includes(safeUser)) {
            return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản hệ thống' });
        }
        const sql = `DROP USER '${safeUser}'@'${safeHost}';`;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`mysql -e ${escapeShellArg(sql)}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function getTables(req, res) {
    try {
        const { vpsConfig, database } = req.body;
        const safeDatabase = sanitizeAlphaNum(database);
        if (!safeDatabase) {
            return res.status(400).json({ success: false, error: 'Tên Database không hợp lệ' });
        }
        const sql = `SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${safeDatabase}';`;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const tableResult = await ssh.executeCommand(`mysql ${safeDatabase} -e ${escapeShellArg(sql)} -sN`);

        const tables = tableResult.stdout.trim().split('\n').filter(l => l).map(line => {
            const [name, rows, data, index] = line.split('\t');
            const size = (parseInt(data) + parseInt(index)) / 1024; // KB
            return { name, rows, size: size.toFixed(2) + ' KB' };
        });

        res.json({ success: true, data: tables });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function exportDatabase(req, res) {
    try {
        const { vpsConfig, name } = req.body;
        const safeName = sanitizeAlphaNum(name);
        if (!safeName) {
            return res.status(400).json({ success: false, error: 'Tên Database không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const fileName = `${safeName}_backup_${Date.now()}.sql`;
        const remotePath = `/tmp/${fileName}`;

        await ssh.executeCommand(`mysqldump ${safeName} > ${escapeShellArg(remotePath)}`);
        res.json({ success: true, data: { remotePath, fileName } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function importDatabase(req, res) {
    try {
        const { vpsConfig, name, remotePath } = req.body;
        const safeName = sanitizeAlphaNum(name);
        if (!safeName) {
            return res.status(400).json({ success: false, error: 'Tên Database không hợp lệ' });
        }
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ssh.executeCommand(`mysql ${safeName} < ${escapeShellArg(remotePath)}`);
        res.json({ success: true, message: 'Import successful' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function repairSystem(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        const sql = "CREATE USER IF NOT EXISTS 'mysql.infoschema'@'localhost' ACCOUNT LOCK; " +
                    "GRANT SELECT ON *.* TO 'mysql.infoschema'@'localhost'; " +
                    "CREATE USER IF NOT EXISTS 'mysql.session'@'localhost' ACCOUNT LOCK; " +
                    "GRANT SELECT ON *.* TO 'mysql.session'@'localhost'; " +
                    "CREATE USER IF NOT EXISTS 'mysql.sys'@'localhost' ACCOUNT LOCK; " +
                    "GRANT SELECT ON *.* TO 'mysql.sys'@'localhost'; " +
                    "CREATE USER IF NOT EXISTS 'debian-sys-maint'@'localhost'; " +
                    "GRANT ALL PRIVILEGES ON *.* TO 'debian-sys-maint'@'localhost' WITH GRANT OPTION; " +
                    "FLUSH PRIVILEGES;";
                    
        await ssh.executeCommand(`mysql -e "${sql}"`);
        res.json({ success: true, message: 'Đã sửa lỗi và khôi phục tài khoản hệ thống MySQL thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listDatabases,
    listUsers,
    addDatabase,
    addUser,
    deleteDatabase,
    deleteUser,
    getTables,
    exportDatabase,
    importDatabase,
    repairSystem
};
