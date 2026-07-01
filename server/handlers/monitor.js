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

    // Ensure state map has the entry for this VPS
    if (!activeVpsMonitors.has(vpsId)) {
        const monitorState = {
            sockets: new Set(),
            interval: null,
            lastData: null,
            lastFetchTime: 0,
            fetching: false,
            staticData: null,
            prevCpuStats: null
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

            if (isLocal && process.platform === 'win32') {
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

            // 1. Fetch static data if not cached yet
            if (!state.staticData) {
                const staticCmd = `
cpu_cores=\$(nproc)
cpu_model=\$(lscpu | grep "Model name" | cut -d':' -f2 | xargs 2>/dev/null || cat /proc/cpuinfo | grep "model name" | head -1 | cut -d':' -f2 | xargs 2>/dev/null || echo "Generic CPU")
mem_total=\$(free -b | grep Mem | awk '{print \$2}')
disk_total=\$(df -h / | tail -1 | awk '{print \$2}')
echo "CORES:\$cpu_cores"
echo "MODEL:\$cpu_model"
echo "MEM_TOTAL:\$mem_total"
echo "DISK_TOTAL:\$disk_total"
                `;
                
                let staticOutput = '';
                if (isLocal) {
                    const { exec } = require('child_process');
                    const util = require('util');
                    const execPromise = util.promisify(exec);
                    const { stdout } = await execPromise(staticCmd);
                    staticOutput = stdout;
                } else {
                    const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
                    const result = await ssh.executeCommand(staticCmd);
                    staticOutput = result.stdout;
                }
                
                const staticStats = {};
                staticOutput.split('\n').forEach(line => {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const value = parts.slice(1).join(':').trim();
                        staticStats[key] = value;
                    }
                });
                
                state.staticData = {
                    cores: parseInt(staticStats['CORES']) || 1,
                    model: staticStats['MODEL'] || 'Generic CPU',
                    memTotal: parseInt(staticStats['MEM_TOTAL']) || 0,
                    diskTotal: staticStats['DISK_TOTAL'] || 'N/A'
                };
            }

            // 2. Fetch dynamic data (optimizing out cpu calculation sleep & query only high cpu/mem tasks when needed)
            const prevCpu = state.lastData?.cpu?.usage || 0;
            const prevMem = state.lastData?.memory?.usage || 0;
            const runPs = prevCpu > 90 || prevMem > 90;

            const dynamicCmd = `
cpu_line=\$(head -n 1 /proc/stat)
echo "CPU_LINE:\$cpu_line"

free -b | grep -q available 2>/dev/null
HAS_AVAIL=\$?
mem_vals=\$(free -b | grep Mem | awk '{print \$3,\$7}')
read -r mem_used_raw mem_avail <<EOF
\$mem_vals
EOF
if [ "\$HAS_AVAIL" -eq 0 ] && [ -n "\$mem_avail" ] && [ "\$mem_avail" -ne 0 ] 2>/dev/null; then
    mem_used=\$(( ${state.staticData.memTotal} - mem_avail ))
else
    mem_used=\$mem_used_raw
fi
echo "MEM_USED:\$mem_used"

disk_vals=\$(df -h / | tail -1 | awk '{print \$3,\$5}')
read -r disk_used disk_pct_raw <<EOF
\$disk_vals
EOF
disk_pct=\$(echo "\$disk_pct_raw" | sed 's/%//')
echo "DISK_USED:\$disk_used"
echo "DISK_PCT:\$disk_pct"

uptime_sec=\$(cat /proc/uptime | awk '{print int(\$1)}')
echo "UPTIME:\$uptime_sec"

top_disk=\$(du -d 1 -h /var/www 2>/dev/null | sort -rh | head -n 6 | tail -n +2 | awk '{print \$2\",\"\$1}' | tr '\\n' ';')
echo "TOP_DISK:\$top_disk"

if [ "${runPs ? '1' : '0'}" = "1" ]; then
    top_cpu=\$(ps -Ao pid,pcpu,pmem,comm --sort=-pcpu | head -n 6 | tail -n 5 | awk '{print \$1\",\"\$2\",\"\$3\",\"\$4}' | tr '\\n' ';')
    top_mem=\$(ps -Ao pid,pcpu,pmem,comm --sort=-pmem | head -n 6 | tail -n 5 | awk '{print \$1\",\"\$2\",\"\$3\",\"\$4}' | tr '\\n' ';')
    echo "TOP_CPU:\$top_cpu"
    echo "TOP_MEM:\$top_mem"
else
    echo "TOP_CPU:"
    echo "TOP_MEM:"
fi
            `;

            if (isLocal) {
                const { exec } = require('child_process');
                const util = require('util');
                const execPromise = util.promisify(exec);
                const { stdout } = await execPromise(dynamicCmd);
                output = stdout;
            } else {
                const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
                const result = await ssh.executeCommand(dynamicCmd);
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

            // Calculate CPU Usage based on /proc/stat (POSIX formula)
            let cpuUsage = 0;
            const cpuLine = stats['CPU_LINE'];
            if (cpuLine) {
                const parts = cpuLine.split(/\s+/).filter(Boolean);
                const user = parseInt(parts[1]) || 0;
                const nice = parseInt(parts[2]) || 0;
                const system = parseInt(parts[3]) || 0;
                const idle = parseInt(parts[4]) || 0;
                const iowait = parseInt(parts[5]) || 0;
                const irq = parseInt(parts[6]) || 0;
                const softirq = parseInt(parts[7]) || 0;
                const steal = parseInt(parts[8]) || 0;

                const currentIdle = idle + iowait;
                const currentNonIdle = user + nice + system + irq + softirq + steal;
                const currentTotal = currentIdle + currentNonIdle;

                if (state.prevCpuStats) {
                    const prev = state.prevCpuStats;
                    const totalDiff = currentTotal - prev.total;
                    const idleDiff = currentIdle - prev.idle;
                    if (totalDiff > 0) {
                        cpuUsage = Math.round(((totalDiff - idleDiff) * 100) / totalDiff);
                    }
                } else {
                    // Fallback for the first tick: average since boot
                    if (currentTotal > 0) {
                        cpuUsage = Math.round((currentNonIdle * 100) / currentTotal);
                    }
                }
                state.prevCpuStats = { idle: currentIdle, total: currentTotal };
            }

            const cpuCores = state.staticData.cores;
            const cpuModel = state.staticData.model;
            const memTotal = state.staticData.memTotal;
            const memUsed = parseInt(stats['MEM_USED']) || 0;
            const diskTotal = state.staticData.diskTotal;
            const diskUsed = stats['DISK_USED'] || 'N/A';
            const diskPct = parseFloat(stats['DISK_PCT']) || 0;
            const uptimeSec = parseInt(stats['UPTIME']) || 0;
            const topCpuRaw = stats['TOP_CPU'] || '';
            const topMemRaw = stats['TOP_MEM'] || '';
            const topDiskRaw = stats['TOP_DISK'] || '';

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

            const parseTopDisk = (rawStr) => {
                if (!rawStr) return [];
                return rawStr.split(';').filter(Boolean).map(p => {
                    const [name, size] = p.split(',');
                    return {
                        name: name || 'unknown',
                        size: size || '0'
                    };
                });
            };

            const topCpu = topCpuRaw ? parseTopProcesses(topCpuRaw) : (state.lastData?.topCpu || []);
            const topMem = topMemRaw ? parseTopProcesses(topMemRaw) : (state.lastData?.topMem || []);
            const topDisk = parseTopDisk(topDiskRaw);

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
                topMem,
                topDisk
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
