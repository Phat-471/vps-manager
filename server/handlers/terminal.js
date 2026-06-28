const { Client } = require('ssh2');
const { spawn } = require('child_process');
const pty = require('child_process');

const activeSessions = new Map();

/**
 * Spawn a local PTY shell using /bin/bash via the system's openpty utility.
 * Falls back to 'script' wrapper if node-pty is unavailable.
 */
function spawnLocalShell(socket, sessionId) {
    // Try node-pty first for proper PTY support
    let usedNodePty = false;
    let ptyProcess = null;

    try {
        const nodePty = require('node-pty');
        ptyProcess = nodePty.spawn('/bin/bash', [], {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd: process.env.HOME || '/',
            env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
        });
        usedNodePty = true;
    } catch (e) {
        // node-pty not installed, use script fallback
        usedNodePty = false;
    }

    if (usedNodePty && ptyProcess) {
        socket.emit('terminal:ready');
        activeSessions.set(sessionId, { ptyProcess, type: 'local-pty' });

        ptyProcess.onData((data) => {
            socket.emit('terminal:data', data);
        });

        ptyProcess.onExit(() => {
            socket.emit('terminal:closed');
            destroy(socket);
        });

        socket.on('terminal:input', (data) => {
            try { ptyProcess.write(data); } catch (e) {}
        });

        socket.on('terminal:resize', ({ cols, rows }) => {
            try {
                if (cols > 0 && rows > 0) {
                    ptyProcess.resize(cols, rows);
                }
            } catch (e) {}
        });

        return;
    }

    // Fallback: use 'script' to allocate pseudo-TTY
    const shell = spawn('bash', ['-c', 'script -q -c /bin/bash /dev/null'], {
        env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor'
        },
        detached: false
    });

    socket.emit('terminal:ready');
    activeSessions.set(sessionId, { shell, type: 'local-script' });

    shell.stdout.on('data', (data) => {
        socket.emit('terminal:data', data.toString('binary'));
    });

    shell.stderr.on('data', (data) => {
        socket.emit('terminal:data', data.toString('binary'));
    });

    shell.on('close', () => {
        socket.emit('terminal:closed');
        destroy(socket);
    });

    shell.on('error', (err) => {
        socket.emit('terminal:error', { error: err.message });
        destroy(socket);
    });

    socket.on('terminal:input', (data) => {
        if (shell.stdin.writable) {
            shell.stdin.write(data);
        }
    });

    socket.on('terminal:resize', () => {
        // Cannot resize without PTY - ignored in fallback mode
    });
}

/**
 * Create terminal session
 */
function create(socket, vpsConfig) {
    const sessionId = socket.id;

    // Clean up existing session first
    if (activeSessions.has(sessionId)) {
        destroy(socket);
    }

    const isLocal = !vpsConfig.host
        || vpsConfig.host === 'localhost'
        || vpsConfig.host === '127.0.0.1'
        || vpsConfig.host === '0.0.0.0';

    if (isLocal) {
        spawnLocalShell(socket, sessionId);
        return;
    }

    // Remote SSH session
    const ssh = new Client();

    const connectTimeout = setTimeout(() => {
        socket.emit('terminal:error', { error: 'Kết nối SSH timeout (15s). Vui lòng kiểm tra lại IP/Port và thông tin đăng nhập.' });
        ssh.end();
        destroy(socket);
    }, 15000);

    ssh.on('ready', () => {
        clearTimeout(connectTimeout);

        ssh.shell(
            {
                term: 'xterm-256color',
                cols: 120,
                rows: 30,
            },
            (err, stream) => {
                if (err) {
                    socket.emit('terminal:error', { error: err.message });
                    destroy(socket);
                    return;
                }

                socket.emit('terminal:ready');
                activeSessions.set(sessionId, { ssh, stream, type: 'ssh' });

                stream.on('data', (data) => {
                    socket.emit('terminal:data', data.toString('binary'));
                });

                stream.stderr.on('data', (data) => {
                    socket.emit('terminal:data', data.toString('binary'));
                });

                stream.on('close', () => {
                    socket.emit('terminal:closed');
                    destroy(socket);
                });

                socket.on('terminal:input', (data) => {
                    if (stream.writable) {
                        stream.write(data);
                    }
                });

                socket.on('terminal:resize', ({ cols, rows }) => {
                    if (stream.writable && cols > 0 && rows > 0) {
                        stream.setWindow(rows, cols);
                    }
                });
            }
        );
    });

    ssh.on('error', (err) => {
        clearTimeout(connectTimeout);
        let friendlyMsg = err.message;
        if (err.message.includes('ECONNREFUSED')) {
            friendlyMsg = `Kết nối bị từ chối (ECONNREFUSED). Kiểm tra cổng SSH ${vpsConfig.port || 22} đã mở chưa.`;
        } else if (err.message.includes('ETIMEDOUT')) {
            friendlyMsg = `Kết nối timeout. IP/Port không trả lời: ${vpsConfig.host}:${vpsConfig.port || 22}`;
        } else if (err.message.includes('Authentication')) {
            friendlyMsg = 'Sai tên đăng nhập hoặc mật khẩu SSH.';
        }
        socket.emit('terminal:error', { error: friendlyMsg });
        destroy(socket);
    });

    ssh.on('close', () => {
        socket.emit('terminal:closed');
        destroy(socket);
    });

    ssh.connect({
        host: vpsConfig.host,
        port: parseInt(vpsConfig.port) || 22,
        username: vpsConfig.username || 'root',
        password: vpsConfig.password,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        algorithms: {
            kex: [
                'ecdh-sha2-nistp256',
                'diffie-hellman-group14-sha256',
                'diffie-hellman-group14-sha1',
                'diffie-hellman-group1-sha1'
            ],
            serverHostKey: [
                'ssh-rsa',
                'ecdsa-sha2-nistp256',
                'ssh-ed25519'
            ],
            cipher: [
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr',
                'aes128-gcm',
                'aes256-gcm'
            ],
            hmac: [
                'hmac-sha2-256',
                'hmac-sha2-512',
                'hmac-sha1'
            ]
        }
    });
}

/**
 * Destroy terminal session and clean up resources
 */
function destroy(socket) {
    const sessionId = socket.id;

    if (!activeSessions.has(sessionId)) return;

    const session = activeSessions.get(sessionId);

    try {
        if (session.type === 'local-pty' && session.ptyProcess) {
            session.ptyProcess.kill();
        } else if (session.type === 'local-script' && session.shell) {
            session.shell.stdin.end();
            session.shell.kill('SIGTERM');
            setTimeout(() => {
                try { session.shell.kill('SIGKILL'); } catch (e) {}
            }, 1000);
        } else if (session.type === 'ssh') {
            if (session.stream) session.stream.end();
            if (session.ssh) session.ssh.end();
        }
    } catch (e) {
        // Ignore cleanup errors
    }

    activeSessions.delete(sessionId);
}

/**
 * Get count of active sessions
 */
function getActiveCount() {
    return activeSessions.size;
}

module.exports = {
    create,
    destroy,
    getActiveCount
};
