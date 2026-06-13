const { connectionPool } = require('../utils/ssh');

const activeMonitors = new Map();

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

    if (activeMonitors.has(socketId)) {
        stop(socket);
    }

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

    // Monitor interval
    const interval = setInterval(async () => {
        try {
            const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
            const result = await ssh.executeCommand(cmd);
            const output = result.stdout;

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

            // Send to client
            socket.emit('monitor:data', {
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
            });

        } catch (err) {
            socket.emit('monitor:error', {
                error: err.message
            });
        }
    }, 2000); // Update every 2 seconds

    activeMonitors.set(socketId, interval);
}

/**
 * Stop monitoring
 */
function stop(socket) {
    const socketId = socket.id;

    if (activeMonitors.has(socketId)) {
        clearInterval(activeMonitors.get(socketId));
        activeMonitors.delete(socketId);
    }
}

module.exports = {
    start,
    stop
};
