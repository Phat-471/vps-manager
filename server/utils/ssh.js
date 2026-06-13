const { Client } = require('ssh2');

class SSHConnection {
    constructor(config) {
        this.config = {
            host: config.host,
            port: config.port || 22,
            username: config.username,
            password: config.password
        };
        this.client = null;
        this.isConnected = false;
    }

    /**
     * Kết nối đến VPS
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.client = new Client();

            this.client.on('ready', () => {
                this.isConnected = true;
                console.log('SSH Connected:', this.config.host);
                resolve(true);
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                console.error('SSH Error:', err.message);
                reject(err);
            });

            this.client.on('close', () => {
                this.isConnected = false;
                console.log('SSH Connection closed:', this.config.host);
            });

            try {
                this.client.connect(this.config);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Ngắt kết nối
     */
    disconnect() {
        if (this.client) {
            this.client.end();
            this.isConnected = false;
        }
    }

    /**
     * Thực thi lệnh trên VPS
     */
    executeCommand(command) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH not connected'));
            }

            this.client.exec(command, (err, stream) => {
                if (err) {
                    return reject(err);
                }

                let stdout = '';
                let stderr = '';

                stream.on('close', (code, signal) => {
                    resolve({
                        code,
                        signal,
                        stdout,
                        stderr
                    });
                });

                stream.on('data', (data) => {
                    stdout += data.toString();
                });

                stream.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            });
        });
    }

    /**
     * Đọc nội dung file
     */
    readFile(remotePath) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH not connected'));
            }

            this.client.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                sftp.readFile(remotePath, 'utf8', (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(data);
                });
            });
        });
    }

    /**
     * Ghi nội dung vào file
     */
    writeFile(remotePath, content) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH not connected'));
            }

            this.client.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                sftp.writeFile(remotePath, content, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    /**
     * Upload file lên VPS
     */
    uploadFile(localPath, remotePath) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH not connected'));
            }

            this.client.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    /**
     * Download file từ VPS
     */
    downloadFile(remotePath, localPath) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH not connected'));
            }

            this.client.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                sftp.fastGet(remotePath, localPath, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(true);
                });
            });
        });
    }

    /**
     * Kiểm tra file/folder có tồn tại không
     */
    exists(remotePath) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                return reject(new Error('SSH not connected'));
            }

            this.client.sftp((err, sftp) => {
                if (err) {
                    return reject(err);
                }

                sftp.stat(remotePath, (err, stats) => {
                    if (err) {
                        if (err.code === 2) { // No such file
                            resolve(false);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(true);
                    }
                });
            });
        });
    }
}

// Connection pool để quản lý nhiều VPS connections
class SSHConnectionPool {
    constructor() {
        this.connections = new Map();
    }

    /**
     * Lấy hoặc tạo connection mới
     */
    async getConnection(vpsId, config) {
        const key = vpsId || `${config.host}:${config.username}`;

        if (this.connections.has(key)) {
            const conn = this.connections.get(key);
            if (conn.isConnected) {
                return conn;
            }
        }

        const connection = new SSHConnection(config);
        await connection.connect();
        this.connections.set(key, connection);
        return connection;
    }

    /**
     * Ngắt kết nối
     */
    disconnect(vpsId) {
        if (this.connections.has(vpsId)) {
            const conn = this.connections.get(vpsId);
            conn.disconnect();
            this.connections.delete(vpsId);
        }
    }

    /**
     * Ngắt tất cả kết nối
     */
    disconnectAll() {
        for (const [key, conn] of this.connections) {
            conn.disconnect();
        }
        this.connections.clear();
    }
}

const connectionPool = new SSHConnectionPool();

module.exports = {
    SSHConnection,
    connectionPool
};
