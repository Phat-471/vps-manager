const { connectionPool } = require('../utils/ssh');
const { escapeShellArg } = require('../utils/security');
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

        const result = await ssh.executeCommand(command);

        if (result.code !== 0 || result.stdout.includes('ERROR:')) {
            return res.status(500).json({
                success: false,
                error: 'Sao lưu thất bại',
                log: result.stdout + '\n' + result.stderr
            });
        }

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
        const { vpsConfig, filename, restorePath, dbUser, dbPass } = req.body;

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
        if (filename.startsWith('backup_dir_')) {
            if (!restorePath) {
                return res.status(400).json({ success: false, error: 'Vui lòng cung cấp đường dẫn thư mục khôi phục' });
            }
            // Giải nén đè vào đường dẫn chỉ định
            result = await ssh.executeCommand(`tar -xzf ${backupFilePath} -C ${escapeShellArg(restorePath)}`);
        } else if (filename.startsWith('backup_db_')) {
            // Lấy database name từ filename
            const match = filename.match(/^backup_db_(.*)_(\d{8}_\d{6})\.sql\.gz$/);
            if (!match) {
                return res.status(400).json({ success: false, error: 'Tên file backup MySQL không đúng định dạng' });
            }
            const dbName = match[1];

            // Đảm bảo database tồn tại trước khi import
            await ssh.executeCommand(`mysql -e 'CREATE DATABASE IF NOT EXISTS \`${dbName}\`;'`);

            let importCmd = `gunzip -c ${backupFilePath} | mysql `;
            if (dbPass) {
                importCmd += `-u${dbUser || 'root'} -p'${dbPass.replace(/'/g, "'\\''")}' ${dbName}`;
            } else {
                importCmd += `-u${dbUser || 'root'} ${dbName}`;
            }

            result = await ssh.executeCommand(importCmd);
        } else {
            return res.status(400).json({ success: false, error: 'Loại file backup không được hỗ trợ để tự động phục hồi' });
        }

        if (result.code !== 0) {
            return res.status(500).json({
                success: false,
                error: 'Khôi phục dữ liệu thất bại',
                log: result.stderr
            });
        }

        res.json({
            success: true,
            message: 'Khôi phục dữ liệu thành công!'
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

        const localDir = path.join(__dirname, '../../uploads');
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

module.exports = {
    listBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    RUNNER_PATH // Export path for cron configuration
};
