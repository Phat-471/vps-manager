const { Client } = require('ssh2');

const activeSessions = new Map();

/**
 * Create terminal session
 */
function create(socket, vpsConfig) {
    const sessionId = socket.id;

    if (activeSessions.has(sessionId)) {
        destroy(socket);
    }

    const ssh = new Client();

    ssh.on('ready', () => {
        socket.emit('terminal:ready');

        ssh.shell((err, stream) => {
            if (err) {
                socket.emit('terminal:error', { error: err.message });
                return;
            }

            // Store session
            activeSessions.set(sessionId, { ssh, stream });

            // Send terminal output to client
            stream.on('data', (data) => {
                socket.emit('terminal:data', data.toString());
            });

            stream.stderr.on('data', (data) => {
                socket.emit('terminal:data', data.toString());
            });

            stream.on('close', () => {
                socket.emit('terminal:closed');
                destroy(socket);
            });

            // Receive input from client
            socket.on('terminal:input', (data) => {
                if (stream.writable) {
                    stream.write(data);
                }
            });

            socket.on('terminal:resize', ({ cols, rows }) => {
                if (stream.writable) {
                    stream.setWindow(rows, cols);
                }
            });
        });
    });

    ssh.on('error', (err) => {
        socket.emit('terminal:error', { error: err.message });
        destroy(socket);
    });

    ssh.on('close', () => {
        socket.emit('terminal:closed');
        destroy(socket);
    });

    // Connect to VPS
    ssh.connect({
        host: vpsConfig.host,
        port: vpsConfig.port || 22,
        username: vpsConfig.username,
        password: vpsConfig.password
    });
}

/**
 * Destroy terminal session
 */
function destroy(socket) {
    const sessionId = socket.id;

    if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);

        if (session.stream) {
            session.stream.end();
        }

        if (session.ssh) {
            session.ssh.end();
        }

        activeSessions.delete(sessionId);
    }
}

module.exports = {
    create,
    destroy
};
