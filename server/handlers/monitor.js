const { connectionPool } = require('../utils/ssh');

// Maps vpsId -> { interval, sockets: Set(socket), lastData, lastFetchTime, fetching }
const activeVpsMonitors = new Map();

// Maps socketId -> vpsId
const socketToVpsMap = new Map();

/**
 * Start monitoring
 */
function start(socket, vpsConfig) {
    if (!vpsConfig) {
        console.error('Error: vpsConfig is missing in monitor:start');
        socket.emit('monitor:error', { error: 'VPS configuration is missing.' });
        return;
    }

    const socketId = socket.id;
    const vpsId = vpsConfig.id;

    // If socket is already monitoring something, stop it first
    if (socketToVpsMap.has(socketId)) {
        stop(socket);
    }

    socketToVpsMap.set(socketId, vpsId);

    // Command to fetch stats in one go
    const cmd = `
cpu_usage=\$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\\\([0-9.]*\\\\)%* id.*/\\\\1/" | awk '{print 100 - \$1}')
cpu_cores=\$(nproc)
cpu_model=\$(lscpu | grep "Model name" | cut -d':' -f2 | xargs 2>/dev/null || cat /proc/cpuinfo | grep "model name" | head -1 | cut -d':' -f2 | xargs 2>/dev/null || echo "Generic CPU")
read -r mem_total mem_used < <(free -b | grep Mem | awk '{print \$2,\$3}')
read -r disk_total disk_used < <(df -h / | tail -1 | awk '{print \$2,\$3}')
disk_pct=\$(df -h / | tail -1 | awk '{print \$5}' | sed 's/%//')
uptime_sec=\$(cat /proc/uptime | awk '{print int(\$1)}')

echo "CPU_USAGE:\$cpu_usage"
echo "CPU_CORES:\$cpu_cores"
echo "CPU_MODEL:\$cpu_model"
echo "MEM_TOTAL:\$mem_total"
echo "MEM_USED:\$mem_used"
echo "DISK_TOTAL:\$disk_total"
echo "DISK_USED:\$disk_used"
echo "DISK_PCT:\$disk_pct"
echo "UPTIME:\$uptime_sec"
`;

    // Ensure state map has the entry for this VPS
    if (!activeVpsMonitors.has(vpsId)) {
        const monitorState = {
            sockets: new Set(),
            interval: null,
            lastData: null,
            lastFetchTime: 0,
            fetching: false
        };
        activeVpsMonitors.set(vpsId, monitorState);
    }

    const state = activeVpsMonitors.get(vpsId);
    state.sockets.add(socket);

    // If cached data is fresh (less than 4.5 seconds old), push it immediately to this socket
    const CACHE_TTL_MS = 4500;
    const now = Date.now();
    if (state.lastData && (now - state.lastFetchTime < CACHE_TTL_MS)) {
        socket.emit('monitor:data', state.lastData);
    }

    const fetchStats = async () => {
        if (state.fetching) return;
        state.fetching = true;

        try {
            const isLocal = vpsConfig.host === 'localhost' || vpsConfig.host === '127.0.0.1' || vpsConfig.host === '0.0.0.0';
            let output = '';

            if (isLocal) {
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);
                const { stdout } = await execPromise(cmd);
                output = stdout;
            } else {
                const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
                const result = await ssh.executeCommand(cmd);
                output = result.stdout;
            }

            // Parse output lines
            const stats = {};
            output.split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim();
                    stats[key] = value;
                }
            });

            const cpuUsage = parseFloat(stats['CPU_USAGE']) || 0;
            const cpuCores = parseInt(stats['CPU_CORES']) || 1;
            const cpuModel = stats['CPU_MODEL'] || 'N/A';
            const memTotal = parseInt(stats['MEM_TOTAL']) || 0;
            const memUsed = parseInt(stats['MEM_USED']) || 0;
            const diskTotal = stats['DISK_TOTAL'] || 'N/A';
            const diskUsed = stats['DISK_USED'] || 'N/A';
            const diskPct = parseFloat(stats['DISK_PCT']) || 0;
            const uptimeSec = parseInt(stats['UPTIME']) || 0;

            const data = {
                timestamp: Date.now(),
                cpu: {
                    usage: cpuUsage,
                    cores: cpuCores,
                    model: cpuModel
                },
                memory: {
                    usage: memTotal > 0 ? (memUsed / memTotal) * 100 : 0,
                    total: memTotal,
                    used: memUsed
                },
                disk: {
                    usage: diskPct,
                    total: diskTotal,
                    used: diskUsed
                },
                uptime: uptimeSec
            };

            state.lastData = data;
            state.lastFetchTime = Date.now();

            // Broadcast to all sockets subscribed to this VPS
            for (const s of state.sockets) {
                s.emit('monitor:data', data);
            }

        } catch (err) {
            console.error(`[Monitor] Error fetching stats for VPS ${vpsId}:`, err.message);
            for (const s of state.sockets) {
                s.emit('monitor:error', { error: err.message });
            }
        } finally {
            state.fetching = false;
        }
    };

    // If there is no active interval, start one
    if (!state.interval) {
        // Fetch immediately on startup
        fetchStats();
        // Set up 5-second updates (5000ms)
        state.interval = setInterval(fetchStats, 5000);
    }
}

/**
 * Stop monitoring
 */
function stop(socket) {
    const socketId = socket.id;
    const vpsId = socketToVpsMap.get(socketId);

    if (vpsId) {
        socketToVpsMap.delete(socketId);
        const state = activeVpsMonitors.get(vpsId);
        if (state) {
            state.sockets.delete(socket);
            // If no more sockets are listening to this VPS, clean up resources
            if (state.sockets.size === 0) {
                if (state.interval) {
                    clearInterval(state.interval);
                }
                activeVpsMonitors.delete(vpsId);
            }
        }
    }
}

module.exports = {
    start,
    stop
};
