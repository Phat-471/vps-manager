const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const crypto = require('crypto');

const configPath = path.join(__dirname, '../data/alerts_config.json');

// Secret key derivation (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.PANEL_PASSWORD || 'vps-manager-server-default-key-32b';
const IV_LENGTH = 16;

function encrypt(text) {
    try {
        if (!text) return '';
        let key = ENCRYPTION_KEY;
        if (key.length < 32) {
            key = key.padEnd(32, 'x');
        } else if (key.length > 32) {
            key = key.substring(0, 32);
        }
        
        let iv = crypto.randomBytes(IV_LENGTH);
        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (err) {
        console.error('Encryption error:', err);
        return text;
    }
}

function decrypt(text) {
    try {
        if (!text) return '';
        let key = ENCRYPTION_KEY;
        if (key.length < 32) {
            key = key.padEnd(32, 'x');
        } else if (key.length > 32) {
            key = key.substring(0, 32);
        }

        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        console.error('Decryption error:', err);
        return text;
    }
}

function readConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            return { 
                channels: { 
                    telegram: { enabled: false, botToken: '', chatId: '' }, 
                    discord: { enabled: false, webhookUrl: '' } 
                }, 
                thresholds: {} 
            };
        }
        const raw = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading alerts_config.json:', err);
        return { 
            channels: { 
                telegram: { enabled: false, botToken: '', chatId: '' }, 
                discord: { enabled: false, webhookUrl: '' } 
            }, 
            thresholds: {} 
        };
    }
}

function writeConfig(config) {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing alerts_config.json:', err);
        return false;
    }
}

function sendTelegramAlert(botToken, chatId, message) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${botToken}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve(body);
                    }
                } else {
                    reject(new Error(`Telegram API Error: Status ${res.statusCode}. Response: ${body}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

function sendDiscordAlert(webhookUrl, message) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(webhookUrl);
        const data = JSON.stringify({
            content: message
        });

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`Discord API Error: Status ${res.statusCode}. Response: ${body}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(data);
        req.end();
    });
}

async function getConfig(req, res) {
    try {
        const config = readConfig();
        const safeConfig = JSON.parse(JSON.stringify(config));
        
        if (safeConfig.channels.telegram.botToken) {
            const token = safeConfig.channels.telegram.botToken;
            safeConfig.channels.telegram.botToken = token.length > 10 
                ? token.substring(0, 6) + '...' + token.substring(token.length - 4)
                : token;
        }
        if (safeConfig.channels.discord.webhookUrl) {
            const urlStr = safeConfig.channels.discord.webhookUrl;
            safeConfig.channels.discord.webhookUrl = urlStr.length > 25 
                ? urlStr.substring(0, 20) + '...' + urlStr.substring(urlStr.length - 8)
                : urlStr;
        }
        
        const thresholdsList = {};
        for (const [vpsId, threshold] of Object.entries(safeConfig.thresholds)) {
            thresholdsList[vpsId] = {
                enabled: threshold.enabled,
                cpuLimit: threshold.cpuLimit,
                ramLimit: threshold.ramLimit,
                diskLimit: threshold.diskLimit,
                downtimeAlert: threshold.downtimeAlert || false,
                autoHealing: threshold.autoHealing || false
            };
        }
        
        res.json({
            success: true,
            data: {
                channels: safeConfig.channels,
                thresholds: thresholdsList
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveChannels(req, res) {
    try {
        const { telegram, discord } = req.body;
        const config = readConfig();
        
        if (telegram) {
            let botToken = telegram.botToken;
            if (botToken && botToken.includes('...')) {
                botToken = config.channels.telegram.botToken;
            }
            config.channels.telegram = {
                enabled: !!telegram.enabled,
                botToken: botToken || '',
                chatId: telegram.chatId || ''
            };
        }
        
        if (discord) {
            let webhookUrl = discord.webhookUrl;
            if (webhookUrl && webhookUrl.includes('...')) {
                webhookUrl = config.channels.discord.webhookUrl;
            }
            config.channels.discord = {
                enabled: !!discord.enabled,
                webhookUrl: webhookUrl || ''
            };
        }
        
        writeConfig(config);
        res.json({ success: true, message: 'Đã lưu cấu hình kênh thông báo thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function saveThreshold(req, res) {
    try {
        const { vpsConfig, enabled, cpuLimit, ramLimit, diskLimit, downtimeAlert, autoHealing } = req.body;
        
        if (!vpsConfig || !vpsConfig.id) {
            return res.status(400).json({ success: false, error: 'Thiếu cấu hình VPS' });
        }
        
        const config = readConfig();
        
        config.thresholds[vpsConfig.id] = {
            id: vpsConfig.id,
            host: vpsConfig.host,
            port: vpsConfig.port || 22,
            username: vpsConfig.username,
            password: encrypt(vpsConfig.password),
            enabled: !!enabled,
            cpuLimit: parseInt(cpuLimit) || 90,
            ramLimit: parseInt(ramLimit) || 90,
            diskLimit: parseInt(diskLimit) || 90,
            downtimeAlert: !!downtimeAlert,
            autoHealing: !!autoHealing
        };
        
        writeConfig(config);
        res.json({ success: true, message: 'Đã cập nhật cấu hình cảnh báo của VPS thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function testTelegram(req, res) {
    try {
        const { botToken, chatId } = req.body;
        const config = readConfig();
        
        let token = botToken;
        if (token && token.includes('...')) {
            token = config.channels.telegram.botToken;
        }
        
        if (!token || !chatId) {
            return res.status(400).json({ success: false, error: 'Thiếu Bot Token hoặc Chat ID' });
        }

        const msg = `🔔 <b>VPS Manager Test Message</b>\n\nChúc mừng! Kênh cảnh báo Telegram của bạn đã được kết nối và hoạt động chính xác.`;
        await sendTelegramAlert(token, chatId, msg);
        
        res.json({ success: true, message: 'Đã gửi tin nhắn test qua Telegram thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function testDiscord(req, res) {
    try {
        const { webhookUrl } = req.body;
        const config = readConfig();
        
        let urlStr = webhookUrl;
        if (urlStr && urlStr.includes('...')) {
            urlStr = config.channels.discord.webhookUrl;
        }
        
        if (!urlStr) {
            return res.status(400).json({ success: false, error: 'Thiếu Discord Webhook URL' });
        }

        const msg = `🔔 **VPS Manager Test Message**\n\nChúc mừng! Kênh cảnh báo Discord của bạn đã được kết nối và hoạt động chính xác.`;
        await sendDiscordAlert(urlStr, msg);
        
        res.json({ success: true, message: 'Đã gửi tin nhắn test qua Discord thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

const historyPath = path.join(__dirname, '../data/alerts_history.json');

function readHistory() {
    try {
        if (!fs.existsSync(historyPath)) {
            return [];
        }
        const raw = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading alerts_history.json:', err);
        return [];
    }
}

function writeHistory(history) {
    try {
        const dir = path.dirname(historyPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing alerts_history.json:', err);
        return false;
    }
}

function logAlertEvent(event) {
    const history = readHistory();
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const newEvent = {
        id,
        timestamp: new Date().toISOString(),
        ...event
    };
    history.unshift(newEvent);
    const limited = history.slice(0, 200);
    writeHistory(limited);
    return newEvent;
}

async function getAlertHistory(req, res) {
    try {
        const history = readHistory();
        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

async function clearAlertHistory(req, res) {
    try {
        writeHistory([]);
        res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử cảnh báo!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getConfig,
    saveChannels,
    saveThreshold,
    testTelegram,
    testDiscord,
    readConfig,
    decrypt,
    sendTelegramAlert,
    sendDiscordAlert,
    logAlertEvent,
    getAlertHistory,
    clearAlertHistory
};

