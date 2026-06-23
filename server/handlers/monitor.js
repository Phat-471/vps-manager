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

    // Command to fetch stats in one go without heavy top process (POSIX-compliant)
    const cmd = `
cpu_line=\$(head -n 1 /proc/stat)
read -r _ user nice system idle iowait irq softirq steal guest guest_nice <<EOF
\$cpu_line
EOF
prev_idle=\$((idle + iowait))
prev_non_idle=\$((user + nice + system + irq + softirq + steal))
prev_total=\$((prev_idle + prev_non_idle))

sleep 0.2

cpu_line=\$(head -n 1 /proc/stat)
read -r _ user nice system idle iowait irq softirq steal guest guest_nice <<EOF
\$cpu_line
EOF
idle=\$((idle + iowait))
non_idle=\$((user + nice + system + irq + softirq + steal))
total=\$((idle + non_idle))

total_diff=\$((total - prev_total))
idle_diff=\$((idle - prev_idle))

if [ "\$total_diff" -gt 0 ]; then
    cpu_usage=\$(( (total_diff - idle_diff) * 100 / total_diff ))
else
    cpu_usage=0
fi

cpu_cores=\$(nproc)
cpu_model=\$(lscpu | grep "Model name" | cut -d':' -f2 | xargs 2>/dev/null || cat /proc/cpuinfo | grep "model name" | head -1 | cut -d':' -f2 | xargs 2>/dev/null || echo "Generic CPU")

free -b | grep -q available 2>/dev/null
HAS_AVAIL=\$?
mem_vals=\$(free -b | grep Mem | awk '{print \$2,\$3,\$7}')
read -r mem_total mem_used_raw mem_avail <<EOF
\$mem_vals
EOF
if [ "\$HAS_AVAIL" -eq 0 ] && [ -n "\$mem_avail" ] && [ "\$mem_avail" -ne 0 ] 2>/dev/null; then
    mem_used=\$((mem_total - mem_avail))
else
    mem_used=\$mem_used_raw
fi

disk_vals=\$(df -h / | tail -1 | awk '{print \$2,\$3,\$5}')
read -r disk_total disk_used disk_pct_raw <<EOF
\$disk_vals
EOF
disk_pct=\$(echo "\$disk_pct_raw" | sed 's/%//')

uptime_sec=\$(cat /proc/uptime | awk '{print int(\$1)}')

mem_used_pct=\$(( mem_used * 100 / mem_total ))
if [ "\$cpu_usage" -gt 90 ] || [ "\$mem_used_pct" -gt 90 ] 2>/dev/null; then
    top_cpu=\$(ps -Ao pid,pcpu,pmem,comm --sort=-pcpu | head -n 6 | tail -n 5 | awk '{print \$1\",\"\$2\",\"\$3\",\"\$4}' | tr '\\n' ';')
    top_mem=\$(ps -Ao pid,pcpu,pmem,comm --sort=-pmem | head -n 6 | tail -n 5 | awk '{print \$1\",\"\$2\",\"\$3\",\"\$4}' | tr '\\n' ';')
else
    top_cpu=""
    top_mem=""
fi

echo "CPU_USAGE:\$cpu_usage"
echo "CPU_CORES:\$cpu_cores"
echo "CPU_MODEL:\$cpu_model"
echo "MEM_TOTAL:\$mem_total"
echo "MEM_USED:\$mem_used"
echo "DISK_TOTAL:\$disk_total"
echo "DISK_USED:\$disk_used"
echo "DISK_PCT:\$disk_pct"
echo "UPTIME:\$uptime_sec"
echo "TOP_CPU:\$top_cpu"
echo "TOP_MEM:\$top_mem"
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
            const os = require('os');
            const interfaces = os.networkInterfaces();
            const localIPs = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
            for (const name of Object.keys(interfaces)) {
                for (const net of interfaces[name]) {
                    localIPs.add(net.address);
                }
            }
            const isLocal = localIPs.has(vpsConfig.host);
            let output = '';

            if (isLocal) {
                if (process.platform === 'win32') {
                    // Windows Development Mode stats fallback using Node.js os module
                    const cpus = os.cpus();
                    const totalMem = os.totalmem();
                    const freeMem = os.freemem();
                    const usedMem = totalMem - freeMem;
                    const cpuModel = cpus[0] ? cpus[0].model : 'Generic CPU';
                    const cpuCores = cpus.length;

                    // Calculate average CPU idle time to estimate usage
                    let totalIdle = 0;
                    let totalTick = 0;
                    cpus.forEach(cpu => {
                        for (const type in cpu.times) {
                            totalTick += cpu.times[type];
                        }
                        totalIdle += cpu.times.idle;
                    });
                    const cpuUsage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 10;

                    const data = {
                        timestamp: Date.now(),
                        cpu: {
                            usage: Math.round(cpuUsage),
                            cores: cpuCores,
                            model: cpuModel
                        },
                        memory: {
                            usage: (usedMem / totalMem) * 100,
                            total: totalMem,
                            used: usedMem
                        },
                        disk: {
                            usage: 92, // Mock 92% to trigger smart warning banner locally for testing
                            total: '40 GB',
                            used: '36.8 GB'
                        },
                        uptime: os.uptime(),
                        topCpu: [
                            { pid: 3204, cpu: 88.5, mem: 12.4, name: 'mysqld' },
                            { pid: 5612, cpu: 45.2, mem: 4.1, name: 'nginx' },
                            { pid: 1244, cpu: 12.0, mem: 8.5, name: 'php-fpm' }
                        ],
                        topMem: [
                            { pid: 3204, cpu: 88.5, mem: 42.5, name: 'mysqld' },
                            { pid: 8904, cpu: 0.5, mem: 28.0, name: 'node-app' },
                            { pid: 1244, cpu: 12.0, mem: 18.5, name: 'php-fpm' }
                        ]
                    };

                    state.lastData = data;
                    state.lastFetchTime = Date.now();
                    for (const s of state.sockets) {
                        s.emit('monitor:data', data);
                    }
                    return;
                }

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
            const topCpuRaw = stats['TOP_CPU'] || '';
            const topMemRaw = stats['TOP_MEM'] || '';

            // Parse top processes "pid,cpu,mem,name;..."
            const parseTopProcesses = (rawStr) => {
                if (!rawStr) return [];
                return rawStr.split(';').filter(Boolean).map(p => {
                    const [pid, cpu, mem, name] = p.split(',');
                    return {
                        pid: parseInt(pid) || 0,
                        cpu: parseFloat(cpu) || 0,
                        mem: parseFloat(mem) || 0,
                        name: name || 'unknown'
                    };
                });
            };

            const topCpu = parseTopProcesses(topCpuRaw);
            const topMem = parseTopProcesses(topMemRaw);

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
                uptime: uptimeSec,
                topCpu,
                topMem
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
