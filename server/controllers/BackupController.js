const { connectionPool } = require('../utils/ssh');
const { escapeShellArg } = require('../utils/security');
const { logActivity } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = '/var/www/vps-manager-backups';
const RUNNER_PATH = `${BACKUP_DIR}/backup-runner.sh`;

// Bash script content for backup runner
const BACKUP_RUNNER_SCRIPT = `#!/bin/bash

# Default values
TYPE=""
SOURCE=""
DATABASE=""
DB_USER="root"
DB_PASS=""
DEST="${BACKUP_DIR}"
KEEP=5
NAME=""
RCLONE_REMOTE=""
RCLONE_PATH=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --type=*)
      TYPE="\${arg#*=}"
      shift
      ;;
    --source=*)
      SOURCE="\${arg#*=}"
      shift
      ;;
    --database=*)
      DATABASE="\${arg#*=}"
      shift
      ;;
    --db-user=*)
      DB_USER="\${arg#*=}"
      shift
      ;;
    --db-pass=*)
      DB_PASS="\${arg#*=}"
      shift
      ;;
    --dest=*)
      DEST="\${arg#*=}"
      shift
      ;;
    --keep=*)
      KEEP="\${arg#*=}"
      shift
      ;;
    --name=*)
      NAME="\${arg#*=}"
      shift
      ;;
    --rclone-remote=*)
      RCLONE_REMOTE="\${arg#*=}"
      shift
      ;;
    --rclone-path=*)
      RCLONE_PATH="\${arg#*=}"
      shift
      ;;
  esac
done

# Validate type
if [ "$TYPE" != "dir" ] && [ "$TYPE" != "mysql" ]; then
  echo "ERROR: Invalid backup type. Must be 'dir' or 'mysql'."
  exit 1
fi

# Create destination folder
mkdir -p "$DEST"
if [ ! -d "$DEST" ]; then
  echo "ERROR: Cannot create destination directory $DEST."
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ "$TYPE" == "dir" ]; then
  if [ -z "$SOURCE" ]; then
    echo "ERROR: Missing --source directory."
    exit 1
  fi
  if [ ! -d "$SOURCE" ]; then
    echo "ERROR: Source directory $SOURCE does not exist."
    exit 1
  fi
  
  if [ -z "$NAME" ]; then
    NAME=$(basename "$SOURCE")
  fi
  
  TARGET_FILE="$DEST/backup_dir_\${NAME}_\${TIMESTAMP}.tar.gz"
  echo "Starting backup of directory $SOURCE to $TARGET_FILE..."
  
  tar -czf "$TARGET_FILE" -C "\$(dirname "$SOURCE")" "\$(basename "$SOURCE")"
  
  if [ $? -eq 0 ]; then
    echo "SUCCESS: Directory backup completed successfully."
    # Prune old backups
    echo "Pruning old directory backups (keeping last $KEEP)..."
    cd "$DEST" || exit
    ls -t backup_dir_\${NAME}_*.tar.gz 2>/dev/null | tail -n +\$((KEEP + 1)) | while read -r old_file; do
      echo "Deleting old backup file: \$old_file"
      rm -f "\$old_file"
    done
  else
    echo "ERROR: Tar compression failed."
    exit 1
  fi

elif [ "$TYPE" == "mysql" ]; then
  if [ -z "$DATABASE" ]; then
    echo "ERROR: Missing --database name."
    exit 1
  fi
  
  if [ -z "$NAME" ]; then
    NAME="$DATABASE"
  fi
  
  TARGET_FILE="$DEST/backup_db_\${NAME}_\${TIMESTAMP}.sql.gz"
  echo "Starting backup of database $DATABASE to $TARGET_FILE..."
  
  # Check if password is provided
  if [ -n "$DB_PASS" ]; then
    CNF_FILE=$(mktemp)
    cat <<EOF > "$CNF_FILE"
[client]
user=$DB_USER
password="$DB_PASS"
EOF
    mysqldump --defaults-extra-file="$CNF_FILE" --single-transaction --quick "$DATABASE" | gzip > "$TARGET_FILE"
    rm -f "$CNF_FILE"
  else
    mysqldump -u "$DB_USER" --single-transaction --quick "$DATABASE" | gzip > "$TARGET_FILE"
  fi
  
  if [ $? -eq 0 ]; then
    echo "SUCCESS: MySQL backup completed successfully."
    # Prune old backups
    echo "Pruning old database backups (keeping last $KEEP)..."
    cd "$DEST" || exit
    ls -t backup_db_\${NAME}_*.sql.gz 2>/dev/null | tail -n +\$((KEEP + 1)) | while read -r old_file; do
      echo "Deleting old backup file: \$old_file"
      rm -f "\$old_file"
    done
  else
    echo "ERROR: MySQL dump failed."
    rm -f "$TARGET_FILE"
    exit 1
  fi
fi

# Rclone Cloud Sync
if [ -n "$TARGET_FILE" ] && [ -f "$TARGET_FILE" ] && [ -n "$RCLONE_REMOTE" ]; then
  echo "Syncing backup file $TARGET_FILE to cloud remote $RCLONE_REMOTE:$RCLONE_PATH..."
  which rclone &>/dev/null
  if [ $? -eq 0 ]; then
    rclone copy "$TARGET_FILE" "\${RCLONE_REMOTE}:\${RCLONE_PATH}"
    if [ $? -eq 0 ]; then
      echo "SUCCESS: Cloud sync completed."
    else
      echo "WARNING: Cloud sync failed."
    fi
  else
    echo "WARNING: Rclone is not installed. Cloud sync skipped."
  fi
fi
`;

/**
 * Đảm bảo script backup tồn tại và có quyền thực thi
 */
async function ensureBackupScript(ssh) {
    await ssh.executeCommand(`mkdir -p ${BACKUP_DIR}`);
    await ssh.writeFile(RUNNER_PATH, BACKUP_RUNNER_SCRIPT);
    await ssh.executeCommand(`chmod +x ${RUNNER_PATH}`);
}

/**
 * API: Lấy danh sách các file backup
 */
async function listBackups(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        await ensureBackupScript(ssh);

        const result = await ssh.executeCommand(`ls -lh --time-style=long-iso ${BACKUP_DIR} 2>/dev/null || true`);
        const lines = result.stdout.trim().split('\n');
        const backups = [];

        for (const line of lines) {
            if (!line.trim() || line.startsWith('total')) continue;

            const parts = line.trim().split(/\s+/);
            if (parts.length < 8) continue;

            const filename = parts.slice(7).join(' ');
            if (!filename.startsWith('backup_')) continue;

            // Phân tích tên file: backup_[dir|db]_[name]_[date]_[time].[ext]
            let type = 'unknown';
            let targetName = 'unknown';
            let dateStr = 'unknown';

            if (filename.startsWith('backup_dir_')) {
                type = 'dir';
                const match = filename.match(/^backup_dir_(.*)_(\d{8}_\d{6})\.tar\.gz$/);
                if (match) {
                    targetName = match[1];
                    dateStr = match[2];
                }
            } else if (filename.startsWith('backup_db_')) {
                type = 'mysql';
                const match = filename.match(/^backup_db_(.*)_(\d{8}_\d{6})\.sql\.gz$/);
                if (match) {
                    targetName = match[1];
                    dateStr = match[2];
                }
            }

            let formattedDate = dateStr;
            if (dateStr && dateStr.length === 15) {
                const y = dateStr.substring(0, 4);
                const m = dateStr.substring(4, 6);
                const d = dateStr.substring(6, 8);
                const h = dateStr.substring(9, 11);
                const min = dateStr.substring(11, 13);
                const s = dateStr.substring(13, 15);
                formattedDate = `${y}-${m}-${d} ${h}:${min}:${s}`;
            }

            backups.push({
                filename,
                size: parts[4],
                modified: `${parts[5]} ${parts[6]}`,
                type,
                targetName,
                createdAt: formattedDate
            });
        }

        // Sắp xếp bản mới nhất lên đầu
        backups.sort((a, b) => b.filename.localeCompare(a.filename));

        res.json({
            success: true,
            data: backups
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Tạo bản sao lưu mới (Chạy thủ công)
 */
async function createBackup(req, res) {
    try {
        const { vpsConfig, type, source, database, dbUser, dbPass, keep = 5, name } = req.body;

        if (!type || (type !== 'dir' && type !== 'mysql')) {
            return res.status(400).json({ success: false, error: 'Loại backup không hợp lệ (dir hoặc mysql)' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ensureBackupScript(ssh);

        let command = `/bin/bash ${RUNNER_PATH} --type=${type} --keep=${keep}`;
        if (type === 'dir') {
            if (!source) return res.status(400).json({ success: false, error: 'Thiếu đường dẫn thư mục nguồn' });
            command += ` --source=${escapeShellArg(source)}`;
            if (name) command += ` --name=${escapeShellArg(name)}`;
        } else if (type === 'mysql') {
            if (!database) return res.status(400).json({ success: false, error: 'Thiếu tên Database' });
            command += ` --database=${escapeShellArg(database)}`;
            if (dbUser) command += ` --db-user=${escapeShellArg(dbUser)}`;
            if (dbPass) command += ` --db-pass=${escapeShellArg(dbPass)}`;
        }

        if (req.body.rcloneRemote) {
            command += ` --rclone-remote=${escapeShellArg(req.body.rcloneRemote)}`;
            if (req.body.rclonePath) {
                command += ` --rclone-path=${escapeShellArg(req.body.rclonePath)}`;
            }
        }

        const result = await ssh.executeCommand(command);

        if (result.code !== 0 || result.stdout.includes('ERROR:')) {
            return res.status(500).json({
                success: false,
                error: 'Sao lưu thất bại',
                log: result.stdout + '\n' + result.stderr
            });
        }

        logActivity('Tạo Bản sao lưu', `Đã tạo bản sao lưu ${type} (${type === 'dir' ? source : database})`, vpsConfig.id);
        res.json({
            success: true,
            message: 'Đã hoàn thành sao lưu thành công',
            log: result.stdout
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Khôi phục dữ liệu từ bản sao lưu
 */
async function restoreBackup(req, res) {
    try {
        const { vpsConfig, filename, restorePath, dbUser, dbPass, cleanTarget, dropDatabase } = req.body;

        if (!filename) {
            return res.status(400).json({ success: false, error: 'Thiếu tên file backup để khôi phục' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const backupFilePath = `${BACKUP_DIR}/${filename}`;

        // Kiểm tra file có tồn tại không
        const checkFile = await ssh.executeCommand(`ls ${backupFilePath} 2>/dev/null`);
        if (checkFile.code !== 0) {
            return res.status(404).json({ success: false, error: 'File backup không tồn tại trên VPS' });
        }

        let result;
        let logBuffer = '';

        if (filename.startsWith('backup_dir_')) {
            if (!restorePath) {
                return res.status(400).json({ success: false, error: 'Vui lòng cung cấp đường dẫn thư mục khôi phục' });
            }
            const cleanPath = restorePath.trim();
            if (cleanPath === '/' || cleanPath === '' || cleanPath.split('/').filter(Boolean).length <= 1) {
                return res.status(400).json({ success: false, error: 'Đường dẫn thư mục khôi phục quá ngắn hoặc không an toàn để dọn dẹp' });
            }

            if (cleanTarget) {
                logBuffer += `[INFO] Đang làm sạch thư mục đích: ${cleanPath}...\n`;
                const cleanResult = await ssh.executeCommand(`rm -rf ${escapeShellArg(cleanPath)}/*`);
                logBuffer += cleanResult.stdout + '\n' + cleanResult.stderr + '\n';
            }

            logBuffer += `[INFO] Đang giải nén tệp sao lưu vào ${cleanPath}...\n`;
            result = await ssh.executeCommand(`tar -xzf ${backupFilePath} -C ${escapeShellArg(cleanPath)}`);
            logBuffer += result.stdout + '\n' + result.stderr + '\n';
        } else if (filename.startsWith('backup_db_')) {
            // Lấy database name từ filename
            const match = filename.match(/^backup_db_(.*)_(\d{8}_\d{6})\.sql\.gz$/);
            if (!match) {
                return res.status(400).json({ success: false, error: 'Tên file backup MySQL không đúng định dạng' });
            }
            const dbName = match[1];

            if (dropDatabase) {
                logBuffer += `[INFO] Đang xóa (Drop) cơ sở dữ liệu cũ \`${dbName}\`...\n`;
                const dropResult = await ssh.executeCommand(`mysql -e 'DROP DATABASE IF EXISTS \`${dbName}\`; CREATE DATABASE \`${dbName}\`;'`);
                logBuffer += dropResult.stdout + '\n' + dropResult.stderr + '\n';
            } else {
                logBuffer += `[INFO] Khởi tạo cơ sở dữ liệu \`${dbName}\` nếu chưa tồn tại...\n`;
                const createResult = await ssh.executeCommand(`mysql -e 'CREATE DATABASE IF NOT EXISTS \`${dbName}\`;'`);
                logBuffer += createResult.stdout + '\n' + createResult.stderr + '\n';
            }

            let importCmd = `gunzip -c ${backupFilePath} | mysql `;
            if (dbPass) {
                importCmd += `-u${dbUser || 'root'} -p'${dbPass.replace(/'/g, "'\\''")}' ${dbName}`;
            } else {
                importCmd += `-u${dbUser || 'root'} ${dbName}`;
            }

            logBuffer += `[INFO] Đang nạp cơ sở dữ liệu từ tệp nén...\n`;
            result = await ssh.executeCommand(importCmd);
            logBuffer += result.stdout + '\n' + result.stderr + '\n';
        } else {
            return res.status(400).json({ success: false, error: 'Loại file backup không được hỗ trợ để tự động phục hồi' });
        }

        if (result.code !== 0) {
            return res.status(500).json({
                success: false,
                error: 'Khôi phục dữ liệu thất bại',
                log: logBuffer
            });
        }

        logActivity('Khôi phục Bản sao lưu', `Đã khôi phục dữ liệu từ bản sao lưu: ${filename}`, vpsConfig.id);
        res.json({
            success: true,
            message: 'Khôi phục dữ liệu thành công!',
            log: logBuffer
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Xóa bản sao lưu
 */
async function deleteBackup(req, res) {
    try {
        const { vpsConfig, filename } = req.body;

        if (!filename) {
            return res.status(400).json({ success: false, error: 'Thiếu tên file cần xóa' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.executeCommand(`rm -f ${BACKUP_DIR}/${escapeShellArg(filename)}`);
        logActivity('Xóa Bản sao lưu', `Đã xóa tệp tin sao lưu: ${filename}`, vpsConfig.id);
        res.json({
            success: true,
            message: 'Đã xóa file sao lưu thành công'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Tải file sao lưu về máy
 */
async function downloadBackup(req, res) {
    try {
        const { vpsConfig, filename } = req.body;

        if (!filename) {
            return res.status(400).json({ success: false, error: 'Thiếu tên file để tải' });
        }

        const localDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        const localPath = path.join(localDir, `download_backup_${Date.now()}_${filename}`);
        const remotePath = `${BACKUP_DIR}/${filename}`;

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        await ssh.downloadFile(remotePath, localPath);

        res.download(localPath, filename, (err) => {
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Cài đặt rclone tự động
 */
async function installRclone(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const result = await ssh.executeCommand('curl https://rclone.org/install.sh | bash');
        logActivity('Cài đặt Rclone', 'Đã khởi chạy tiến trình cài đặt Rclone trên máy chủ', vpsConfig.id);
        res.json({
            success: true,
            message: 'Tiến trình cài đặt Rclone đã chạy',
            log: result.stdout + '\n' + result.stderr
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Kiểm tra trạng thái cài đặt và config Rclone
 */
async function checkRcloneStatus(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const checkInstall = await ssh.executeCommand('which rclone');
        const installed = checkInstall.code === 0;

        let configured = false;
        if (installed) {
            const checkConfig = await ssh.executeCommand('ls /root/.config/rclone/rclone.conf 2>/dev/null');
            configured = checkConfig.code === 0;
        }

        res.json({
            success: true,
            data: {
                installed,
                configured
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Lấy danh sách các rclone remote
 */
async function listRcloneRemotes(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const check = await ssh.executeCommand('which rclone');
        if (check.code !== 0) {
            return res.json({ success: true, remotes: {}, installed: false });
        }

        const result = await ssh.executeCommand('rclone config dump');
        let remotes = {};
        if (result.code === 0) {
            try {
                remotes = JSON.parse(result.stdout.trim() || '{}');
            } catch (e) {
                // empty or invalid
            }
        }

        res.json({
            success: true,
            remotes,
            installed: true
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * Helpers cập nhật INI config
 */
function updateIniConfig(iniContent, name, type, parameters) {
    const lines = iniContent.split(/\r?\n/);
    const newLines = [];
    let insideTargetSection = false;
    let sectionFound = false;

    const sectionHeader = `[${name}]`;
    const sectionBody = [`type = ${type}`];
    for (const [k, v] of Object.entries(parameters)) {
        if (k === 'type' || v === undefined || v === null) continue;
        sectionBody.push(`${k} = ${v}`);
    }

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            if (insideTargetSection) {
                newLines.push(sectionHeader);
                newLines.push(...sectionBody);
                newLines.push('');
                insideTargetSection = false;
            }
            if (trimmed === sectionHeader) {
                insideTargetSection = true;
                sectionFound = true;
                continue;
            }
        }

        if (insideTargetSection) {
            continue;
        }

        newLines.push(line);
    }

    if (insideTargetSection) {
        newLines.push(sectionHeader);
        newLines.push(...sectionBody);
        newLines.push('');
    } else if (!sectionFound) {
        if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
            newLines.push('');
        }
        newLines.push(sectionHeader);
        newLines.push(...sectionBody);
        newLines.push('');
    }

    return newLines.join('\n');
}

function updateIniConfigWithRaw(iniContent, rawConfigBlock) {
    const match = rawConfigBlock.match(/^\s*\[([^\]]+)\]/m);
    if (!match) {
        throw new Error('Định dạng cấu hình không hợp lệ. Phải chứa [tên_remote] ở dòng đầu.');
    }
    const name = match[1].trim();

    const lines = iniContent.split(/\r?\n/);
    const newLines = [];
    let insideTargetSection = false;
    let sectionFound = false;

    const sectionHeader = `[${name}]`;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            if (insideTargetSection) {
                newLines.push(rawConfigBlock.trim());
                newLines.push('');
                insideTargetSection = false;
            }
            if (trimmed === sectionHeader) {
                insideTargetSection = true;
                sectionFound = true;
                continue;
            }
        }

        if (insideTargetSection) {
            continue;
        }

        newLines.push(line);
    }

    if (insideTargetSection) {
        newLines.push(rawConfigBlock.trim());
        newLines.push('');
    } else if (!sectionFound) {
        if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
            newLines.push('');
        }
        newLines.push(rawConfigBlock.trim());
        newLines.push('');
    }

    return newLines.join('\n');
}

function deleteIniSection(iniContent, name) {
    const lines = iniContent.split(/\r?\n/);
    const newLines = [];
    let insideTargetSection = false;
    const sectionHeader = `[${name}]`;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            if (insideTargetSection) {
                insideTargetSection = false;
            }
            if (trimmed === sectionHeader) {
                insideTargetSection = true;
                continue;
            }
        }

        if (insideTargetSection) {
            continue;
        }

        newLines.push(line);
    }

    return newLines.join('\n');
}

/**
 * API: Lưu rclone remote (form/raw)
 */
async function saveRcloneRemote(req, res) {
    try {
        const { vpsConfig, name, type, parameters, rawConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        // Đảm bảo thư mục config tồn tại
        await ssh.executeCommand('mkdir -p /root/.config/rclone');

        // Đọc config hiện tại
        const configPath = '/root/.config/rclone/rclone.conf';
        const readResult = await ssh.executeCommand(`cat ${configPath} 2>/dev/null || true`);
        const currentConfig = readResult.stdout;

        let newConfig = '';
        if (rawConfig) {
            newConfig = updateIniConfigWithRaw(currentConfig, rawConfig);
        } else {
            if (!name || !type || !parameters) {
                return res.status(400).json({ success: false, error: 'Thiếu thông tin cấu hình' });
            }
            newConfig = updateIniConfig(currentConfig, name, type, parameters);
        }

        await ssh.writeFile(configPath, newConfig);
        logActivity('Cấu hình Rclone Remote', `Đã lưu cấu hình Cloud remote: "${name || 'raw config'}"`, vpsConfig.id);
        res.json({
            success: true,
            message: 'Đã lưu cấu hình remote thành công'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Xóa rclone remote
 */
async function deleteRcloneRemote(req, res) {
    try {
        const { vpsConfig, name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Thiếu tên remote cần xóa' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const configPath = '/root/.config/rclone/rclone.conf';
        const readResult = await ssh.executeCommand(`cat ${configPath} 2>/dev/null || true`);
        const currentConfig = readResult.stdout;

        const newConfig = deleteIniSection(currentConfig, name);
        await ssh.writeFile(configPath, newConfig);
        logActivity('Xóa Rclone Remote', `Đã xóa cấu hình Cloud remote: "${name}"`, vpsConfig.id);
        res.json({
            success: true,
            message: 'Đã xóa remote thành công'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Kiểm tra kết nối rclone remote
 */
async function testRcloneRemote(req, res) {
    try {
        const { vpsConfig, name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Thiếu tên remote cần kiểm tra' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const result = await ssh.executeCommand(`rclone lsd ${escapeShellArg(name)}:`);

        res.json({
            success: result.code === 0,
            code: result.code,
            stdout: result.stdout,
            stderr: result.stderr
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Đồng bộ thủ công một file backup hiện tại lên Cloud Remote
 */
async function syncFileToCloud(req, res) {
    try {
        const { vpsConfig, filename, rcloneRemote, rclonePath } = req.body;
        if (!filename || !rcloneRemote) {
            return res.status(400).json({ success: false, error: 'Thiếu tên file hoặc tên Cloud Remote' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const remotePath = rclonePath || '';
        const localFilePath = `${BACKUP_DIR}/${filename}`;

        // Execute rclone copy command
        const cmd = `rclone copy ${escapeShellArg(localFilePath)} ${escapeShellArg(rcloneRemote)}:${escapeShellArg(remotePath)}`;
        const result = await ssh.executeCommand(cmd);

        if (result.code !== 0) {
            return res.status(500).json({
                success: false,
                error: 'Không thể đồng bộ tệp lên đám mây',
                details: result.stderr || result.stdout
            });
        }

        logActivity('Đồng bộ Cloud', `Đã tải tệp sao lưu ${filename} lên remote cloud ${rcloneRemote}`, vpsConfig.id);
        res.json({
            success: true,
            message: `Đã đồng bộ tệp ${filename} lên Cloud remote ${rcloneRemote} thành công!`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    installRclone,
    checkRcloneStatus,
    listRcloneRemotes,
    saveRcloneRemote,
    deleteRcloneRemote,
    testRcloneRemote,
    syncFileToCloud,
    RUNNER_PATH
};
