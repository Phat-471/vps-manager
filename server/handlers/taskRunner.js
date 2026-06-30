const { connectionPool } = require('../utils/ssh');
const { spawn } = require('child_process');

const activeTasks = new Map();

/**
 * Start and stream a command execution
 */
async function start(socket, { vpsConfig, command }) {
    const taskId = socket.id;

    if (activeTasks.has(taskId)) {
        stop(socket);
    }

    if (!command) {
        socket.emit('task:ended', { code: 1, error: 'Không tìm thấy lệnh để chạy' });
        return;
    }

    try {
        const isLocal = vpsConfig.host === 'localhost' || vpsConfig.host === '127.0.0.1' || vpsConfig.host === '0.0.0.0';

        if (isLocal) {
            console.log(`[TaskRunner] Running local command: ${command}`);
            const isWin = process.platform === 'win32';
            const shellCmd = isWin ? 'powershell.exe' : '/bin/bash';
            const shellArgs = isWin ? ['-Command', command] : ['-c', command];

            const child = spawn(shellCmd, shellArgs, {
                env: { ...process.env, TERM: 'xterm-256color' }
            });

            activeTasks.set(taskId, { child });

            child.stdout.on('data', (data) => {
                socket.emit('task:output', data.toString());
            });

            child.stderr.on('data', (data) => {
                socket.emit('task:output', data.toString());
            });

            child.on('close', (code) => {
                socket.emit('task:ended', { code });
                activeTasks.delete(taskId);
            });

            child.on('error', (err) => {
                socket.emit('task:ended', { code: 1, error: err.message });
                activeTasks.delete(taskId);
            });
            return;
        }

        console.log(`[TaskRunner] Running SSH command: ${command} on ${vpsConfig.host}`);
        const sshConn = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        sshConn.client.exec(command, (err, stream) => {
            if (err) {
                socket.emit('task:ended', { code: 1, error: err.message });
                return;
            }

            activeTasks.set(taskId, { stream });

            stream.on('data', (data) => {
                socket.emit('task:output', data.toString());
            });

            stream.stderr.on('data', (data) => {
                socket.emit('task:output', data.toString());
            });

            stream.on('close', (code, signal) => {
                socket.emit('task:ended', { code, signal });
                activeTasks.delete(taskId);
            });
        });

    } catch (err) {
        console.error('[TaskRunner] Error:', err.message);
        socket.emit('task:ended', { code: 1, error: err.message });
    }
}

/**
 * Stop running command
 */
function stop(socket) {
    const taskId = socket.id;

    if (activeTasks.has(taskId)) {
        const task = activeTasks.get(taskId);

        if (task.stream) {
            task.stream.destroy();
        }

        if (task.child) {
            task.child.kill();
        }

        activeTasks.delete(taskId);
        console.log(`[TaskRunner] Stopped task: ${taskId}`);
    }
}

module.exports = {
    start,
    stop
};
