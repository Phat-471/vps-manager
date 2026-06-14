const { SSHConnection } = require('./ssh');
const AlertController = require('../controllers/AlertController');

// Cooldown tracking in memory: key `${vpsId}:${metric}` -> timestamp
const lastAlerts = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown between alerts for same metric

let daemonInterval = null;

/**
 * Send alert message through all enabled global channels
 */
async function dispatchAlert(channels, rawMsg, htmlMsg) {
    if (channels.telegram && channels.telegram.enabled) {
        try {
            await AlertController.sendTelegramAlert(
                channels.telegram.botToken,
                channels.telegram.chatId,
                htmlMsg
            );
        } catch (err) {
            console.error('Failed to send Telegram alert:', err.message);
        }
    }

    if (channels.discord && channels.discord.enabled) {
        try {
            await AlertController.sendDiscordAlert(
                channels.discord.webhookUrl,
                rawMsg
            );
        } catch (err) {
            console.error('Failed to send Discord alert:', err.message);
        }
    }
}

/**
 * Check if alert should be throttled (cooldown)
 */
function shouldAlert(vpsId, metric) {
    const key = `${vpsId}:${metric}`;
    const now = Date.now();
    if (lastAlerts.has(key)) {
        const lastTime = lastAlerts.get(key);
        if (now - lastTime < COOLDOWN_MS) {
            return false; // throttled
        }
    }
    lastAlerts.set(key, now);
    return true;
}

/**
 * Clear cooldown when status goes back to normal (optional, but keep simple for now)
 */
function clearCooldown(vpsId, metric) {
    const key = `${vpsId}:${metric}`;
    lastAlerts.delete(key);
}

/**
 * Check a single VPS status
 */
async function checkVPS(vpsId, threshold, channels) {
    const isLocal = threshold.host === 'localhost' || threshold.host === '127.0.0.1' || threshold.host === '0.0.0.0';
    let statsResult;

    try {
        if (isLocal) {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);
            
            let cmdStr = `
                top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
                free -m | grep Mem | awk '{print ($3/$2)*100}'
                df -h / | tail -1 | awk '{print $5}' | tr -d '%'
            `;
            if (threshold.autoHealing) {
                cmdStr += `
                # Auto-healing checks
                services=("nginx" "mysql" "docker" "mariadb")
                php_fpm_services=$(systemctl list-units --type=service --state=running 2>/dev/null | grep php | awk '{print $1}' | cut -d'.' -f1 || echo "")
                for svc in $php_fpm_services; do
                    services+=("$svc")
                done
                for svc in "\${services[@]}"; do
                    if [ -n "$svc" ] && (systemctl is-enabled "$svc" >/dev/null 2>&1 || service "$svc" status >/dev/null 2>&1); then
                        status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
                        if [ "$status" != "active" ]; then
                            echo "SERVICE_DOWN:$svc"
                            systemctl start "$svc" >/dev/null 2>&1 || service "$svc" start >/dev/null 2>&1
                            new_status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
                            if [ "$new_status" = "active" ]; then
                                echo "SERVICE_RECOVERED:$svc"
                            else
                                echo "SERVICE_RECOVERY_FAILED:$svc"
                            fi
                        fi
                    fi
                done
                `;
            }
            
            const { stdout, stderr } = await execPromise(cmdStr);
            statsResult = { code: 0, stdout, stderr };
            
            // Local execution successful, clear downtime cooldown
            clearCooldown(vpsId, 'downtime');
        } else {
            const config = {
                host: threshold.host,
                port: threshold.port || 22,
                username: threshold.username,
                password: AlertController.decrypt(threshold.password)
            };

            const ssh = new SSHConnection(config);
            try {
                // 1. Check SSH connection
                await ssh.connect();

                // Connection successful, clear downtime cooldown if any
                clearCooldown(vpsId, 'downtime');

                // 2. Fetch resource metrics
                let cmdStr = `
                    top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}'
                    free -m | grep Mem | awk '{print ($3/$2)*100}'
                    df -h / | tail -1 | awk '{print $5}' | tr -d '%'
                `;
                if (threshold.autoHealing) {
                    cmdStr += `
                    # Auto-healing checks
                    services=("nginx" "mysql" "docker" "mariadb")
                    php_fpm_services=$(systemctl list-units --type=service --state=running 2>/dev/null | grep php | awk '{print $1}' | cut -d'.' -f1 || echo "")
                    for svc in $php_fpm_services; do
                        services+=("$svc")
                    done
                    for svc in "\${services[@]}"; do
                        if [ -n "$svc" ] && (systemctl is-enabled "$svc" >/dev/null 2>&1 || service "$svc" status >/dev/null 2>&1); then
                            status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
                            if [ "$status" != "active" ]; then
                                echo "SERVICE_DOWN:$svc"
                                systemctl start "$svc" >/dev/null 2>&1 || service "$svc" start >/dev/null 2>&1
                                new_status=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
                                if [ "$new_status" = "active" ]; then
                                    echo "SERVICE_RECOVERED:$svc"
                                else
                                    echo "SERVICE_RECOVERY_FAILED:$svc"
                               fi
                            fi
                        fi
                    done
                    `;
                }
                statsResult = await ssh.executeCommand(cmdStr);
            } finally {
                ssh.disconnect();
            }
        }

        if (statsResult.code !== 0) {
            console.error(`Stats command failed on VPS ${threshold.host}:`, statsResult.stderr);
            return;
        }

        const lines = statsResult.stdout.trim().split('\n');
        if (lines.length < 3) {
            console.error(`Unexpected stats output format from VPS ${threshold.host}:`, statsResult.stdout);
            return;
        }

        const cpuUsage = parseFloat(lines[0].trim());
        const ramUsage = parseFloat(lines[1].trim());
        const diskUsage = parseFloat(lines[2].trim());

        // 3. Evaluate thresholds
        if (!isNaN(cpuUsage) && cpuUsage > threshold.cpuLimit) {
            if (shouldAlert(vpsId, 'cpu')) {
                const rawMsg = `⚠️ **[ALERT] QUÁ TẢI CPU**\n\n**Máy chủ:** ${threshold.host}\n**Sử dụng hiện tại:** ${cpuUsage.toFixed(1)}%\n**Ngưỡng giới hạn:** ${threshold.cpuLimit}%\n\nVui lòng kiểm tra lại các tiến trình đang hoạt động trên VPS.`;
                const htmlMsg = `⚠️ <b>[ALERT] QUÁ TẢI CPU</b>\n\n<b>Máy chủ:</b> ${threshold.host}\n<b>Sử dụng hiện tại:</b> ${cpuUsage.toFixed(1)}<b>Ngưỡng giới hạn:</b> ${threshold.cpuLimit}%\n\nVui lòng kiểm tra lại các tiến trình đang hoạt động trên VPS.`;
                await dispatchAlert(channels, rawMsg, htmlMsg);
            }
        } else {
            clearCooldown(vpsId, 'cpu');
        }

        if (!isNaN(ramUsage) && ramUsage > threshold.ramLimit) {
            if (shouldAlert(vpsId, 'ram')) {
                const rawMsg = `⚠️ **[ALERT] QUÁ TẢI BỘ NHỚ RAM**\n\n**Máy chủ:** ${threshold.host}\n**Sử dụng hiện tại:** ${ramUsage.toFixed(1)}%\n**Ngưỡng giới hạn:** ${threshold.ramLimit}%\n\nVui lòng giải phóng cache hoặc tối ưu hóa dịch vụ.`;
                const htmlMsg = `⚠️ <b>[ALERT] QUÁ TẢI BỘ NHỚ RAM</b>\n\n<b>Máy chủ:</b> ${threshold.host}\n<b>Sử dụng hiện tại:</b> ${ramUsage.toFixed(1)}%\n<b>Ngưỡng giới hạn:</b> ${threshold.ramLimit}%\n\nVui lòng giải phóng cache hoặc tối ưu hóa dịch vụ.`;
                await dispatchAlert(channels, rawMsg, htmlMsg);
            }
        } else {
            clearCooldown(vpsId, 'ram');
        }

        if (!isNaN(diskUsage) && diskUsage > threshold.diskLimit) {
            if (shouldAlert(vpsId, 'disk')) {
                const rawMsg = `⚠️ **[ALERT] CẠN KIỆT DUNG LƯỢNG Ổ ĐĨA**\n\n**Máy chủ:** ${threshold.host}\n**Sử dụng hiện tại:** ${diskUsage.toFixed(1)}%\n**Ngưỡng giới hạn:** ${threshold.diskLimit}%\n\nVui lòng dọn dẹp các tệp tin logs rác hoặc nâng cấp gói đĩa cứng VPS.`;
                const htmlMsg = `⚠️ <b>[ALERT] CẠN KIỆT DUNG LƯỢNG Ổ ĐĨA</b>\n\n<b>Máy chủ:</b> ${threshold.host}\n<b>Sử dụng hiện tại:</b> ${diskUsage.toFixed(1)}%\n<b>Ngưỡng giới hạn:</b> ${threshold.diskLimit}%\n\nVui lòng dọn dẹp các tệp tin logs rác hoặc nâng cấp gói đĩa cứng VPS.`;
                await dispatchAlert(channels, rawMsg, htmlMsg);
            }
        } else {
            clearCooldown(vpsId, 'disk');
        }

        // 4. Evaluate Auto-healing results
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('SERVICE_RECOVERED:')) {
                const svc = trimmedLine.split(':')[1];
                if (shouldAlert(vpsId, `recovery_success:${svc}`)) {
                    const rawMsg = `🔄 **[AUTO-HEALING] KHÔI PHỤC DỊCH VỤ THÀNH CÔNG**\n\n**Máy chủ:** ${threshold.host}\n**Dịch vụ:** \`${svc}\` bị sập đột ngột.\n**Hành động:** Hệ thống đã tự động gửi lệnh khởi động lại (\`systemctl start ${svc}\`) và khôi phục hoạt động thành công!`;
                    const htmlMsg = `🔄 <b>[AUTO-HEALING] KHÔI PHỤC DỊCH VỤ THÀNH CÔNG</b>\n\n<b>Máy chủ:</b> ${threshold.host}\n<b>Dịch vụ:</b> <code>${svc}</code> bị sập đột ngột.\n<b>Hành động:</b> Hệ thống đã tự động gửi lệnh khởi động lại (<code>systemctl start ${svc}</code>) và khôi phục hoạt động thành công!`;
                    await dispatchAlert(channels, rawMsg, htmlMsg);
                }
            } else if (trimmedLine.startsWith('SERVICE_RECOVERY_FAILED:')) {
                const svc = trimmedLine.split(':')[1];
                if (shouldAlert(vpsId, `recovery_fail:${svc}`)) {
                    const rawMsg = `🚨 **[AUTO-HEALING] KHÔI PHỤC DỊCH VỤ THẤT BẠI**\n\n**Máy chủ:** ${threshold.host}\n**Dịch vụ:** \`${svc}\` bị sập đột ngột.\n**Hành động:** Hệ thống đã tự động chạy lệnh khởi động lại nhưng dịch vụ **vẫn không hoạt động**.\n\n⚠️ Vui lòng truy cập Terminal để kiểm tra cấu hình lỗi.`;
                    const htmlMsg = `🚨 <b>[AUTO-HEALING] KHÔI PHỤC DỊCH VỤ THẤT BẠI</b>\n\n<b>Máy chủ:</b> ${threshold.host}\n<b>Dịch vụ:</b> <code>${svc}</code> bị sập đột ngột.\n<b>Hành động:</b> Hệ thống đã tự động chạy lệnh khởi động lại nhưng dịch vụ <b>vẫn không hoạt động</b>.\n\n⚠️ Vui lòng truy cập Terminal để kiểm tra cấu hình lỗi.`;
                    await dispatchAlert(channels, rawMsg, htmlMsg);
                }
            }
        }

    } catch (err) {
        console.error(`AlertDaemon error connecting to VPS ${threshold.host}:`, err.message);

        // 5. Handle downtime alerts
        if (threshold.downtimeAlert) {
            if (shouldAlert(vpsId, 'downtime')) {
                const rawMsg = `🚨 **[ALERT] VPS MẤT KẾT NỐI (DOWNTIME)**\n\n**Máy chủ:** ${threshold.host}\n**Trạng thái:** Không thể thiết lập kết nối SSH tới máy chủ.\n**Chi tiết:** ${err.message}\n\n⚠️ Máy chủ có thể đã sập nguồn, khởi động lại hoặc gặp sự cố mạng diện rộng.`;
                const htmlMsg = `🚨 <b>[ALERT] VPS MẤT KẾT NỐI (DOWNTIME)</b>\n\n<b>Máy chủ:</b> ${threshold.host}\n<b>Trạng thái:</b> Không thể thiết lập kết nối SSH tới máy chủ.\n<b>Chi tiết:</b> ${err.message}\n\n⚠️ Máy chủ có thể đã sập nguồn, khởi động lại hoặc gặp sự cố mạng diện rộng.`;
                await dispatchAlert(channels, rawMsg, htmlMsg);
            }
        }
    }
}

/**
 * Execute checks on all configured thresholds
 */
async function checkAllThresholds() {
    const config = AlertController.readConfig();
    const thresholds = config.thresholds || {};
    const channels = config.channels || {};

    const activeThresholds = Object.entries(thresholds).filter(([_, t]) => t.enabled);
    if (activeThresholds.length === 0) return;

    console.log(`[AlertDaemon] Starting checks for ${activeThresholds.length} VPS configs...`);

    for (const [vpsId, threshold] of activeThresholds) {
        await checkVPS(vpsId, threshold, channels);
    }
}

/**
 * Initialize daemon service
 */
function init() {
    // Run checks on startup and set 5-minute interval
    console.log('[AlertDaemon] Background monitoring daemon initialized.');
    
    // Initial delay check (30 seconds after server starts)
    setTimeout(() => {
        checkAllThresholds().catch(err => console.error('[AlertDaemon] Initial check error:', err));
    }, 30000);

    // 5-minute interval check
    daemonInterval = setInterval(() => {
        checkAllThresholds().catch(err => console.error('[AlertDaemon] Check error:', err));
    }, 5 * 60 * 1000);
}

/**
 * Stop daemon interval
 */
function stop() {
    if (daemonInterval) {
        clearInterval(daemonInterval);
        daemonInterval = null;
        console.log('[AlertDaemon] Daemon monitoring stopped.');
    }
}

module.exports = {
    init,
    stop,
    checkAllThresholds
};
