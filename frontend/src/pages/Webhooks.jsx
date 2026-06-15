import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
    Webhook, 
    Plus, 
    RefreshCw, 
    Play, 
    Trash2, 
    Edit, 
    Copy, 
    FileText, 
    CheckCircle2, 
    XCircle, 
    ExternalLink, 
    GitBranch, 
    Code, 
    Folder, 
    Cpu, 
    Globe, 
    Key, 
    Info 
} from 'lucide-react';

export default function Webhooks() {
    const { apiCall, showToast, currentVPS, isConnected } = useVPS();
    
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pm2Apps, setPm2Apps] = useState([]);
    const [nginxSites, setNginxSites] = useState([]);
    
    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentWebhook, setCurrentWebhook] = useState(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [selectedLogs, setSelectedLogs] = useState('');
    const [selectedCommit, setSelectedCommit] = useState(null);

    // Form states
    const [name, setName] = useState('');
    const [targetType, setTargetType] = useState('nodeapp'); // 'nodeapp' | 'webserver'
    const [targetName, setTargetName] = useState('');
    const [appPath, setAppPath] = useState('');
    const [gitBranch, setGitBranch] = useState('main');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [customCommand, setCustomCommand] = useState('');
    
    // Action tracking
    const [triggeringId, setTriggeringId] = useState(null);

    useEffect(() => {
        if (isConnected) {
            fetchWebhooks();
            fetchTargets();
        }
    }, [isConnected]);

    // Socket.io real-time update handler
    useEffect(() => {
        // Since we are using standard event bus or window socket listener, let's listen to custom event if available
        const handleWebhookUpdate = (event) => {
            fetchWebhooks();
            showToast(`Webhook '${event.detail.webhookId}' vừa hoàn thành deploy!`, event.detail.status === 'success' ? 'success' : 'error');
        };
        
        window.addEventListener('webhook:deployed', handleWebhookUpdate);
        return () => window.removeEventListener('webhook:deployed', handleWebhookUpdate);
    }, []);

    const fetchWebhooks = async () => {
        setLoading(true);
        try {
            const res = await apiCall('/api/webhooks/list', 'POST');
            if (res.success) {
                setWebhooks(res.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch webhooks:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTargets = async () => {
        try {
            // Load PM2 apps
            const pm2Res = await apiCall('/api/applications/list', 'POST');
            if (pm2Res.success) {
                setPm2Apps(pm2Res.data?.apps || []);
            }
            
            // Load Nginx sites
            const nginxRes = await apiCall('/api/webserver/list', 'POST');
            if (nginxRes.success) {
                setNginxSites(nginxRes.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch deployment targets:', err);
        }
    };

    const generateRandomSecret = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let secret = '';
        for (let i = 0; i < 24; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setWebhookSecret(secret);
    };

    const handleOpenCreateModal = () => {
        setIsEditing(false);
        setCurrentWebhook(null);
        setName('');
        setTargetType('nodeapp');
        setTargetName('');
        setAppPath('');
        setGitBranch('main');
        setCustomCommand('');
        generateRandomSecret();
        setShowModal(true);
    };

    const handleOpenEditModal = (webhook) => {
        setIsEditing(true);
        setCurrentWebhook(webhook);
        setName(webhook.name);
        setTargetType(webhook.targetType);
        setTargetName(webhook.targetName);
        setAppPath(webhook.appPath);
        setGitBranch(webhook.gitBranch);
        setWebhookSecret(webhook.webhookSecret);
        setCustomCommand(webhook.customCommand || '');
        setShowModal(true);
    };

    // Auto-fill path and name on selection
    const handleTargetSelection = (name) => {
        setTargetName(name);
        if (targetType === 'nodeapp') {
            const matchedApp = pm2Apps.find(app => app.name === name);
            if (matchedApp && matchedApp.path) {
                setAppPath(matchedApp.path);
            }
        } else {
            const matchedSite = nginxSites.find(site => site.domain === name);
            if (matchedSite && matchedSite.root) {
                setAppPath(matchedSite.root);
            }
        }
    };

    const handleSaveWebhook = async (e) => {
        e.preventDefault();
        if (!name || !targetName || !appPath) {
            showToast('Vui lòng nhập đầy đủ các trường bắt buộc', 'error');
            return;
        }

        const payload = {
            name,
            vpsId: currentVPS.id,
            vpsConfig: currentVPS,
            targetType,
            targetName,
            appPath,
            gitBranch,
            webhookSecret,
            customCommand
        };

        try {
            let res;
            if (isEditing && currentWebhook) {
                res = await apiCall('/api/webhooks/update', 'POST', {
                    id: currentWebhook.id,
                    ...payload
                });
            } else {
                res = await apiCall('/api/webhooks/create', 'POST', payload);
            }

            if (res.success) {
                showToast(isEditing ? 'Đã cập nhật Webhook thành công!' : 'Đã tạo Webhook thành công!', 'success');
                setShowModal(false);
                fetchWebhooks();
            }
        } catch (err) {
            showToast(err.message || 'Lỗi khi lưu cấu hình Webhook', 'error');
        }
    };

    const handleDeleteWebhook = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa Webhook này? Tín hiệu gửi từ Git Provider sau này sẽ không hoạt động.')) return;
        try {
            const res = await apiCall('/api/webhooks/delete', 'POST', { id });
            if (res.success) {
                showToast('Đã xóa Webhook thành công', 'success');
                fetchWebhooks();
            }
        } catch (err) {
            showToast(err.message || 'Lỗi khi xóa Webhook', 'error');
        }
    };

    const handleManualTrigger = async (id) => {
        setTriggeringId(id);
        showToast('Đang kích hoạt tiến trình deploy ngầm...', 'info');
        try {
            const res = await apiCall('/api/webhooks/trigger-manual', 'POST', { id });
            if (res.success) {
                showToast('Đã bắt đầu deploy. Bạn có thể theo dõi Logs chạy ngầm', 'success');
                // Poll/Fetch updates
                setTimeout(fetchWebhooks, 3000);
            }
        } catch (err) {
            showToast(err.message || 'Lỗi kích hoạt deploy', 'error');
        } finally {
            setTriggeringId(null);
        }
    };

    const viewWebhookLogs = (webhook) => {
        if (!webhook.history || webhook.history.length === 0) {
            showToast('Chưa có lịch sử kích hoạt deploy cho webhook này.', 'info');
            return;
        }
        
        const latestRun = webhook.history[0];
        setSelectedLogs(latestRun.output || 'Không có log đầu ra.');
        setSelectedCommit(latestRun.commit);
        setShowLogModal(true);
    };

    const copyToClipboard = (text, typeName) => {
        navigator.clipboard.writeText(text);
        showToast(`Đã sao chép ${typeName} vào Clipboard!`, 'success');
    };

    const getWebhookURL = (webhookId) => {
        return `http://${currentVPS.host}:${process.env.PORT || 3000}/api/webhooks/deploy/${webhookId}`;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="explorer-header">
                <div className="explorer-header-title">
                    <h1 className="text-2xl font-bold tracking-tight">Quản lý Git Webhooks</h1>
                    <p className="text-sm text-gray-400">Tự động hóa CI/CD: Tự động pull code và reload ứng dụng khi bạn push lên GitHub/GitLab</p>
                </div>
                <div className="explorer-toolbar">
                    <button
                        onClick={handleOpenCreateModal}
                        className="btn btn-primary"
                    >
                        <Plus size={16} />
                        Tạo Webhook mới
                    </button>
                    <button
                        onClick={fetchWebhooks}
                        disabled={loading}
                        className="btn btn-glass"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Instruction Banner */}
            <div className="card-glass p-4 rounded-xl flex gap-3 items-start" style={{ border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <Info className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-gray-300 space-y-1">
                    <strong className="text-indigo-300">Hướng dẫn nhanh cấu hình GitHub/GitLab Webhooks:</strong>
                    <p>1. Copy **Payload URL** và **Secret Key** được tạo ra cho ứng dụng của bạn.</p>
                    <p>2. Truy cập kho lưu trữ Git của bạn &gt; Settings &gt; Webhooks &gt; Add Webhook.</p>
                    <p>3. Dán URL vào mục *Payload URL*, chọn Content type là *application/json*, dán Secret vào ô *Secret*.</p>
                    <p>4. Chọn sự kiện *Just the push event* và Lưu lại.</p>
                </div>
            </div>

            {/* Webhooks Grid */}
            {loading ? (
                <div className="text-center py-12 text-gray-400">Đang tải danh sách Webhooks...</div>
            ) : webhooks.length === 0 ? (
                <div className="card-glass p-12 text-center text-gray-400 rounded-xl">
                    Chưa có Webhook nào được cấu hình. Nhấn nút "Tạo Webhook mới" để bắt đầu thiết lập CI/CD tự động.
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {webhooks.map((webhook) => (
                        <div key={webhook.id} className="card-glass p-6 rounded-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                            {/* Top row */}
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Webhook className="text-indigo-400" size={18} />
                                        <h3 className="font-semibold text-lg text-gray-200">{webhook.name}</h3>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                        {webhook.targetType === 'nodeapp' ? (
                                            <span className="flex items-center gap-1 bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-medium">
                                                <Cpu size={12} /> Node APP (PM2)
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-medium">
                                                <Globe size={12} /> Web Server (Nginx)
                                            </span>
                                        )}
                                        <span className="bg-white/5 px-2 py-0.5 rounded font-mono text-[10px]">
                                            Target: {webhook.targetName}
                                        </span>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex flex-col items-end">
                                    {webhook.lastStatus === 'success' && (
                                        <span className="flex items-center gap-1 text-xs text-green-400 font-medium bg-green-500/10 px-2 py-1 rounded-full">
                                            <CheckCircle2 size={12} /> Thành công
                                        </span>
                                    )}
                                    {webhook.lastStatus === 'error' && (
                                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium bg-red-500/10 px-2 py-1 rounded-full">
                                            <XCircle size={12} /> Thất bại
                                        </span>
                                    )}
                                    {webhook.lastStatus === 'never' && (
                                        <span className="text-xs text-gray-400 font-medium bg-white/5 px-2 py-1 rounded-full">
                                            Chưa kích hoạt
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-500 mt-1">
                                        {webhook.lastTriggered ? `Cuối: ${new Date(webhook.lastTriggered).toLocaleTimeString()}` : 'Chưa chạy'}
                                    </span>
                                </div>
                            </div>

                            {/* Details Details */}
                            <div className="space-y-2.5 text-xs text-gray-300 bg-black/20 p-4 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Folder size={14} className="text-gray-400 shrink-0" />
                                    <span className="text-gray-400">Đường dẫn:</span>
                                    <strong className="font-mono truncate" title={webhook.appPath}>{webhook.appPath}</strong>
                                </div>
                                <div className="flex items-center gap-2">
                                    <GitBranch size={14} className="text-gray-400 shrink-0" />
                                    <span className="text-gray-400">Nhánh Git:</span>
                                    <strong className="font-mono text-indigo-300">{webhook.gitBranch}</strong>
                                </div>

                                <hr className="border-white/5 my-2" />

                                {/* URL Copy */}
                                <div className="space-y-1">
                                    <span className="text-gray-400 block">Payload URL:</span>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            readOnly
                                            value={getWebhookURL(webhook.id)}
                                            className="bg-black/30 font-mono text-[10px] text-indigo-200 px-2 py-1 rounded border border-white/5 flex-1 select-all"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(getWebhookURL(webhook.id), 'Payload URL')}
                                            className="btn btn-glass btn-xs px-2"
                                            title="Copy URL"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </div>

                                {/* Secret Copy */}
                                <div className="space-y-1">
                                    <span className="text-gray-400 block">Secret Key:</span>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            readOnly
                                            value={webhook.webhookSecret}
                                            className="bg-black/30 font-mono text-[10px] text-yellow-200 px-2 py-1 rounded border border-white/5 flex-1 select-all"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(webhook.webhookSecret, 'Secret Key')}
                                            className="btn btn-glass btn-xs px-2"
                                            title="Copy Secret"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-between items-center pt-2">
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => handleManualTrigger(webhook.id)}
                                        disabled={triggeringId === webhook.id}
                                        className="btn btn-glass btn-sm text-green-400"
                                    >
                                        <Play size={14} className={triggeringId === webhook.id ? 'animate-pulse' : ''} />
                                        Deploy ngay
                                    </button>
                                    <button
                                        onClick={() => viewWebhookLogs(webhook)}
                                        disabled={!webhook.history || webhook.history.length === 0}
                                        className="btn btn-glass btn-sm text-indigo-300"
                                    >
                                        <FileText size={14} />
                                        Xem Logs
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleOpenEditModal(webhook)}
                                        className="btn btn-glass btn-sm text-gray-300"
                                        style={{ padding: '8px' }}
                                    >
                                        <Edit size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteWebhook(webhook.id)}
                                        className="btn btn-glass btn-sm text-red-500 hover:bg-red-500/10"
                                        style={{ padding: '8px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '550px' }}>
                        <div className="modal-header">
                            <h2>{isEditing ? 'Cấu hình Webhook' : 'Tạo Webhook CI/CD tự động'}</h2>
                            <button onClick={() => setShowModal(false)} className="modal-close-btn">✕</button>
                        </div>
                        <form onSubmit={handleSaveWebhook}>
                            <div className="modal-body space-y-4">
                                <div className="form-group">
                                    <label>Tên Webhook gọi nhớ</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="vd: Deploy API Dự Án Bán Hàng"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="input-glass"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <div className="form-group flex-1">
                                        <label>Loại ứng dụng</label>
                                        <select
                                            value={targetType}
                                            onChange={(e) => {
                                                setTargetType(e.target.value);
                                                setTargetName('');
                                                setAppPath('');
                                            }}
                                            className="input-glass"
                                        >
                                            <option value="nodeapp">NodeJS (PM2 App)</option>
                                            <option value="webserver">Web Server (Nginx Site)</option>
                                        </select>
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Mục tiêu Deploy</label>
                                        {targetType === 'nodeapp' ? (
                                            <select
                                                required
                                                value={targetName}
                                                onChange={(e) => handleTargetSelection(e.target.value)}
                                                className="input-glass"
                                            >
                                                <option value="">-- Chọn App PM2 --</option>
                                                {pm2Apps.map(app => (
                                                    <option key={app.name} value={app.name}>{app.name}</option>
                                                ))}
                                                <option value="custom-type-app">[Nhập thủ công]</option>
                                            </select>
                                        ) : (
                                            <select
                                                required
                                                value={targetName}
                                                onChange={(e) => handleTargetSelection(e.target.value)}
                                                className="input-glass"
                                            >
                                                <option value="">-- Chọn Domain Nginx --</option>
                                                {nginxSites.map(site => (
                                                    <option key={site.domain} value={site.domain}>{site.domain}</option>
                                                ))}
                                                <option value="custom-type-site">[Nhập thủ công]</option>
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Custom target name input if manual is selected */}
                                {(targetName === 'custom-type-app' || targetName === 'custom-type-site') && (
                                    <div className="form-group">
                                        <label>Tên App / Domain mục tiêu (Thủ công)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Tên ứng dụng trong PM2 hoặc domain vhost"
                                            onChange={(e) => setTargetName(e.target.value)}
                                            className="input-glass"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <div className="form-group flex-[2]">
                                        <label>Đường dẫn thư mục chứa Code (CWD)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="vd: /var/www/apps/my-app"
                                            value={appPath}
                                            onChange={(e) => setAppPath(e.target.value)}
                                            className="input-glass font-mono text-xs"
                                        />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label>Nhánh Git (Branch)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="main"
                                            value={gitBranch}
                                            onChange={(e) => setGitBranch(e.target.value)}
                                            className="input-glass font-mono text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="flex justify-between items-center">
                                        <span>Webhook Secret Key (Bảo mật)</span>
                                        <button 
                                            type="button" 
                                            onClick={generateRandomSecret}
                                            className="text-xs text-indigo-400 hover:underline"
                                        >
                                            Tạo khóa ngẫu nhiên
                                        </button>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            required
                                            placeholder="Khóa bí mật dùng để hash sha256"
                                            value={webhookSecret}
                                            onChange={(e) => setWebhookSecret(e.target.value)}
                                            className="input-glass font-mono text-xs flex-1"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="flex items-center gap-1.5">
                                        <Code size={14} className="text-gray-400" />
                                        Lệnh Shell tùy chỉnh chạy sau khi Pull Code (Tùy chọn)
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Ví dụ:&#10;npm run build&#10;composer install --no-dev&#10;php artisan migrate --force"
                                        value={customCommand}
                                        onChange={(e) => setCustomCommand(e.target.value)}
                                        className="input-glass font-mono text-xs w-full"
                                    />
                                    <span className="text-[10px] text-gray-400 block mt-1">
                                        * Đối với Nodeapp, lệnh `npm install` và `pm2 reload` được tự động cấu hình chạy ngầm.
                                    </span>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-glass">Hủy bỏ</button>
                                <button type="submit" className="btn btn-primary">Lưu cấu hình</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Logs Viewer Modal */}
            {showLogModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '800px', maxWidth: '95%' }}>
                        <div className="modal-header">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-indigo-400" />
                                <h2>Lịch sử chi tiết đợt Deploy gần nhất</h2>
                            </div>
                            <button onClick={() => setShowLogModal(false)} className="modal-close-btn">✕</button>
                        </div>
                        <div className="modal-body space-y-4" style={{ padding: '20px' }}>
                            {selectedCommit && (
                                <div className="grid grid-cols-3 gap-4 text-xs bg-white/5 p-3 rounded-lg border border-white/5 font-mono">
                                    <div>
                                        <span className="text-gray-400 block">Commit Hash:</span>
                                        <strong className="text-indigo-300">{selectedCommit.id}</strong>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block">Tác giả (Author):</span>
                                        <strong className="text-gray-200">{selectedCommit.author}</strong>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block">Thông điệp:</span>
                                        <strong className="text-gray-200 truncate block" title={selectedCommit.message}>{selectedCommit.message}</strong>
                                    </div>
                                </div>
                            )}
                            
                            <div className="space-y-1">
                                <span className="text-xs text-gray-400 font-mono">Terminal Output Console Logs:</span>
                                <div 
                                    className="bg-black/60 font-mono text-[11px] text-green-400 p-4 rounded-lg border border-white/5" 
                                    style={{ height: '350px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
                                >
                                    {selectedLogs}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowLogModal(false)} className="btn btn-primary">Đóng cửa sổ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
