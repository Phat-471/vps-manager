const { connectionPool } = require('../utils/ssh');

/**
 * Phân tích cú pháp crontab thô thành các block cấu trúc
 */
function parseCrontab(crontabText) {
    const lines = crontabText.split('\n');
    const blocks = [];
    let pendingName = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('# JOB_NAME:')) {
            pendingName = trimmed.replace('# JOB_NAME:', '').trim();
            continue;
        }

        // Kiểm tra xem job có bị vô hiệu hóa hay không
        if (trimmed.startsWith('# DISABLED:')) {
            const actualJob = trimmed.replace('# DISABLED:', '').trim();
            // Match biểu thức cron tiêu chuẩn hoặc shorthand (@daily, etc.)
            const match = actualJob.match(/^(@reboot|@yearly|@annually|@monthly|@weekly|@daily|@midnight|@hourly|((?:\S+\s+){4}\S+))\s+(.*)$/);
            if (match) {
                blocks.push({
                    type: 'job',
                    name: pendingName || 'Tác vụ tự do',
                    schedule: match[1],
                    command: match[3],
                    active: false
                });
            } else {
                if (pendingName) {
                    blocks.push({ type: 'raw', text: `# JOB_NAME: ${pendingName}` });
                    pendingName = '';
                }
                blocks.push({ type: 'raw', text: line });
            }
            pendingName = '';
            continue;
        }

        // Kiểm tra xem job có đang hoạt động hay không
        const jobMatch = trimmed.match(/^(@reboot|@yearly|@annually|@monthly|@weekly|@daily|@midnight|@hourly|((?:\S+\s+){4}\S+))\s+(.*)$/);
        if (jobMatch && !trimmed.startsWith('#')) {
            blocks.push({
                type: 'job',
                name: pendingName || 'Tác vụ tự do',
                schedule: jobMatch[1],
                command: jobMatch[3],
                active: true
            });
            pendingName = '';
        } else {
            if (pendingName) {
                blocks.push({ type: 'raw', text: `# JOB_NAME: ${pendingName}` });
                pendingName = '';
            }
            blocks.push({ type: 'raw', text: line });
        }
    }

    if (pendingName) {
        blocks.push({ type: 'raw', text: `# JOB_NAME: ${pendingName}` });
    }
    return blocks;
}

/**
 * Chuyển các block cấu trúc thành nội dung crontab thô
 */
function generateCrontab(blocks) {
    return blocks.map(block => {
        if (block.type === 'job') {
            const nameLine = block.name ? `# JOB_NAME: ${block.name}\n` : '';
            if (block.active) {
                return `${nameLine}${block.schedule} ${block.command}`;
            } else {
                return `${nameLine}# DISABLED: ${block.schedule} ${block.command}`;
            }
        } else {
            return block.text;
        }
    }).join('\n');
}

/**
 * Đọc crontab từ VPS
 */
async function getCrontabText(ssh) {
    const result = await ssh.executeCommand('crontab -l');
    if (result.code !== 0) {
        if (result.stderr.toLowerCase().includes('no crontab')) {
            return '';
        }
        throw new Error(result.stderr || 'Không thể đọc cấu hình crontab');
    }
    return result.stdout;
}

/**
 * Ghi đè crontab lên VPS
 */
async function saveCrontabText(ssh, text) {
    // Đảm bảo có dòng trống ở cuối để crontab hoạt động chuẩn xác
    const formattedText = text.trim() ? text.trim() + '\n' : '';
    
    if (!formattedText) {
        // Nếu crontab trống, xóa hẳn crontab của user
        await ssh.executeCommand('crontab -r');
        return;
    }

    const base64Text = Buffer.from(formattedText).toString('base64');
    const result = await ssh.executeCommand(`echo "${base64Text}" | base64 -d | crontab -`);
    if (result.code !== 0) {
        throw new Error(result.stderr || 'Không thể ghi đè cấu hình crontab');
    }
}

/**
 * API: Lấy danh sách cron jobs
 */
async function listJobs(req, res) {
    try {
        const { vpsConfig } = req.body;
        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);

        const crontabText = await getCrontabText(ssh);
        const blocks = parseCrontab(crontabText);

        // Chỉ trả về các job và đính kèm chỉ số index trong danh sách block thô để tương tác sau này
        const jobs = blocks
            .map((block, idx) => ({ ...block, index: idx }))
            .filter(block => block.type === 'job');

        res.json({
            success: true,
            data: jobs
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Thêm cron job mới
 */
async function addJob(req, res) {
    try {
        const { vpsConfig, name, schedule, command, active = true } = req.body;
        
        if (!schedule || !command) {
            return res.status(400).json({ success: false, error: 'Thiếu thông số schedule hoặc command' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const crontabText = await getCrontabText(ssh);
        const blocks = parseCrontab(crontabText);

        // Thêm job mới vào cuối danh sách block
        blocks.push({
            type: 'job',
            name: name || 'Tác vụ tự do',
            schedule: schedule.trim(),
            command: command.trim(),
            active: !!active
        });

        const newCrontabText = generateCrontab(blocks);
        await saveCrontabText(ssh, newCrontabText);

        res.json({ success: true, message: 'Đã thêm tác vụ lập lịch thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Chỉnh sửa cron job
 */
async function editJob(req, res) {
    try {
        const { vpsConfig, index, name, schedule, command, active } = req.body;

        if (index === undefined) {
            return res.status(400).json({ success: false, error: 'Thiếu chỉ số index của tác vụ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const crontabText = await getCrontabText(ssh);
        const blocks = parseCrontab(crontabText);

        if (!blocks[index] || blocks[index].type !== 'job') {
            return res.status(404).json({ success: false, error: 'Không tìm thấy tác vụ phù hợp để sửa' });
        }

        // Cập nhật thông tin
        if (name !== undefined) blocks[index].name = name;
        if (schedule !== undefined) blocks[index].schedule = schedule.trim();
        if (command !== undefined) blocks[index].command = command.trim();
        if (active !== undefined) blocks[index].active = !!active;

        const newCrontabText = generateCrontab(blocks);
        await saveCrontabText(ssh, newCrontabText);

        res.json({ success: true, message: 'Đã cập nhật tác vụ lập lịch thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Bật / Tắt cron job
 */
async function toggleJob(req, res) {
    try {
        const { vpsConfig, index } = req.body;

        if (index === undefined) {
            return res.status(400).json({ success: false, error: 'Thiếu chỉ số index của tác vụ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const crontabText = await getCrontabText(ssh);
        const blocks = parseCrontab(crontabText);

        if (!blocks[index] || blocks[index].type !== 'job') {
            return res.status(404).json({ success: false, error: 'Không tìm thấy tác vụ phù hợp' });
        }

        // Đảo chiều trạng thái kích hoạt
        blocks[index].active = !blocks[index].active;

        const newCrontabText = generateCrontab(blocks);
        await saveCrontabText(ssh, newCrontabText);

        res.json({ 
            success: true, 
            message: `Đã ${blocks[index].active ? 'kích hoạt' : 'vô hiệu hóa'} tác vụ thành công`,
            active: blocks[index].active
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Xóa cron job
 */
async function deleteJob(req, res) {
    try {
        const { vpsConfig, index } = req.body;

        if (index === undefined) {
            return res.status(400).json({ success: false, error: 'Thiếu chỉ số index của tác vụ' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        const crontabText = await getCrontabText(ssh);
        const blocks = parseCrontab(crontabText);

        if (!blocks[index] || blocks[index].type !== 'job') {
            return res.status(404).json({ success: false, error: 'Không tìm thấy tác vụ để xóa' });
        }

        // Xóa block tại vị trí index
        blocks.splice(index, 1);

        const newCrontabText = generateCrontab(blocks);
        await saveCrontabText(ssh, newCrontabText);

        res.json({ success: true, message: 'Đã xóa tác vụ lập lịch thành công' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * API: Chạy thử command thủ công tức thì
 */
async function runJobManually(req, res) {
    try {
        const { vpsConfig, command } = req.body;

        if (!command) {
            return res.status(400).json({ success: false, error: 'Thiếu câu lệnh chạy thử' });
        }

        const ssh = await connectionPool.getConnection(vpsConfig.id, vpsConfig);
        
        // Thực thi lệnh và giới hạn thời gian chạy
        const result = await ssh.executeCommand(`timeout 60 ${command}`);

        res.json({
            success: true,
            data: {
                code: result.code,
                stdout: result.stdout,
                stderr: result.stderr
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    listJobs,
    addJob,
    editJob,
    toggleJob,
    deleteJob,
    runJobManually
};
