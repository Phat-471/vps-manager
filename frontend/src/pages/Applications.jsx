import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { Play, Square, RotateCw, Trash2, FileText, Settings, Plus, RefreshCw, Cpu, HardDrive, Clock, ExternalLink, AlertTriangle } from 'lucide-react';


export default function Applications() {
  const { apiCall, showToast, currentVPS } = useVPS();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasPM2, setHasPM2] = useState(true);

  // App Wizard
  const [showWizard, setShowWizard] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppPort, setNewAppPort] = useState('3000');
  const [newAppTemplate, setNewAppTemplate] = useState('express-api');
  const [newAppDesc, setNewAppDesc] = useState('');

  // Logs Modal
  const [selectedAppLogs, setSelectedAppLogs] = useState(null);
  const [logsText, setLogsText] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // Env Modal
  const [selectedAppEnv, setSelectedAppEnv] = useState(null);
  const [envPairs, setEnvPairs] = useState([]);
  const [envLoading, setEnvLoading] = useState(false);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/applications/list', 'POST');
      setApps(res.data?.apps || []);
      setHasPM2(res.data?.hasPM2 ?? true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, appName) => {
    try {
      showToast(`Đang thực hiện ${action} cho ${appName}...`, 'info');
      await apiCall(`/api/applications/${action}`, 'POST', { appName });
      showToast(`Đã ${action === 'start' ? 'khởi động' : action === 'stop' ? 'dừng' : 'khởi động lại'} ứng dụng`, 'success');
      fetchApps();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (appName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa và dừng hoàn toàn ứng dụng PM2 "${appName}"?`)) return;
    try {
      await apiCall('/api/applications/delete', 'POST', { appName });
      showToast(`Đã xóa ứng dụng ${appName}`, 'success');
      fetchApps();
    } catch (err) {
      console.error(err);
    }
  };

  const viewLogs = async (appName) => {
    setSelectedAppLogs(appName);
    setLogsLoading(true);
    setLogsText('');
    try {
      const res = await apiCall('/api/applications/logs', 'POST', { appName, lines: 100 });
      setLogsText(res.data?.logs || 'Không có log.');
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadEnv = async (app) => {
    setSelectedAppEnv(app);
    setEnvLoading(true);
    setEnvPairs([]);
    try {
      const res = await apiCall('/api/applications/get-env', 'POST', { appPath: app.path });
      const envObj = res.data?.env || {};
      const pairs = Object.entries(envObj).map(([key, val]) => ({ key, val }));
      setEnvPairs(pairs.length > 0 ? pairs : [{ key: '', val: '' }]);
    } catch (err) {
      console.error(err);
    } finally {
      setEnvLoading(false);
    }
  };

  const saveEnv = async () => {
    if (!selectedAppEnv) return;
    const envObj = {};
    envPairs.forEach(p => {
      if (p.key.trim()) envObj[p.key.trim()] = p.val;
    });

    try {
      showToast('Đang lưu .env và khởi động lại ứng dụng...', 'info');
      await apiCall('/api/applications/save-env', 'POST', {
        appPath: selectedAppEnv.path,
        appName: selectedAppEnv.name,
        env: envObj
      });
      showToast('Cấu hình môi trường đã được cập nhật!', 'success');
      setSelectedAppEnv(null);
      fetchApps();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateApp = async (e) => {
    e.preventDefault();
    if (!newAppName.trim() || !newAppPort.trim()) return;
    try {
      showToast(`Đang deploy template ${newAppTemplate}...`, 'info');
      await apiCall('/api/applications/create-wizard', 'POST', {
        appName: newAppName,
        port: newAppPort,
        template: newAppTemplate,
        description: newAppDesc
      });
      showToast('Deploy thành công với PM2!', 'success');
      setShowWizard(false);
      setNewAppName('');
      setNewAppDesc('');
      fetchApps();
    } catch (err) {
      console.error(err);
    }
  };

  const formatMemory = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const getUptime = (timestamp) => {
    if (!timestamp) return 'Offline';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Quản lý ứng dụng NodeJS</h1>
          <p className="text-sm text-gray-400">Vận hành ứng dụng NodeJS/Express/React thông qua tiến trình PM2</p>
        </div>
        <div className="explorer-toolbar">
          <button
            onClick={() => setShowWizard(true)}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Tạo ứng dụng mới
          </button>
          <button
            onClick={fetchApps}
            disabled={loading}
            className="btn btn-glass"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Missing PM2 Warning */}
      {!hasPM2 && (
        <div className="db-warning-card">
          <AlertTriangle className="db-warning-icon text-red-500" size={24} />
          <div className="db-warning-text">
            <strong className="db-warning-title text-red-400" style={{ fontSize: '14px' }}>PM2 chưa được cài đặt trên VPS này!</strong>
            <p className="text-gray-400" style={{ marginTop: '4px' }}>
              Để quản lý ứng dụng, vui lòng truy cập Terminal hoặc Scripts để cài đặt PM2 thông qua câu lệnh:
              <code className="bg-white/10 px-1.5 py-0.5 rounded text-white font-mono" style={{ marginLeft: '6px' }}>npm install -g pm2</code>
            </p>
          </div>
        </div>
      )}

      {/* Applications List */}
      {hasPM2 && (
        <div className="db-list-wrapper">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Đang truy vấn danh sách ứng dụng...</div>
          ) : apps.length === 0 ? (
            <div className="card-glass p-12 text-center text-gray-400 rounded-xl">
              Không tìm thấy ứng dụng NodeJS nào đang chạy trong PM2. Nhấn nút "Tạo ứng dụng mới" để bắt đầu deploy.
            </div>
          ) : (
            apps.map((app) => (
              <div key={app.name} className="db-list-item flex-col md:flex-row gap-4" style={{ alignItems: 'stretch' }}>
                {/* Left Section: App Details */}
                <div className="db-item-details flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${app.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} style={{ display: 'inline-block', boxShadow: app.status === 'online' ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none' }} />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-lg text-gray-200">{app.name}</span>
                        <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded font-mono" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>ID: {app.pm_id}</span>
                        {app.port && (
                          <a
                            href={`http://${currentVPS.host}:${app.port}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-300 flex items-center gap-0.5 hover:underline"
                          >
                            Port: {app.port} <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 block font-mono mt-1 bg-black/20 p-1 rounded inline-block" style={{ width: 'fit-content' }}>
                        CWD: {app.path}
                       </span>
                    </div>
                  </div>
                </div>

                {/* Middle Section: System Metrics */}
                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300" style={{ minWidth: '320px' }}>
                  <div className="flex items-center gap-1.5">
                    <Cpu size={16} className="text-indigo-400" />
                    <span>CPU: <strong className="font-mono text-xs text-indigo-300">{app.cpu}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HardDrive size={16} className="text-indigo-400" />
                    <span>RAM: <strong className="font-mono text-xs text-indigo-300">{formatMemory(app.memory)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className="text-indigo-400" />
                    <span>Uptime: <strong className="font-mono text-xs text-indigo-300">{getUptime(app.uptime)}</strong></span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Restarts: <strong className="font-mono text-gray-200">{app.restarts}</strong>
                  </div>
                </div>

                {/* Right Section: Action Controls */}
                <div className="db-item-actions" style={{ display: 'flex', gap: '6px' }}>
                  {app.status === 'online' ? (
                    <button
                      onClick={() => handleAction('stop', app.name)}
                      title="Dừng app"
                      className="btn btn-glass btn-sm text-yellow-400"
                      style={{ padding: '8px' }}
                    >
                      <Square size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('start', app.name)}
                      title="Khởi chạy app"
                      className="btn btn-glass btn-sm text-green-400"
                      style={{ padding: '8px' }}
                    >
                      <Play size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleAction('restart', app.name)}
                    title="Khởi động lại"
                    className="btn btn-glass btn-sm text-blue-400"
                    style={{ padding: '8px' }}
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    onClick={() => viewLogs(app.name)}
                    title="Xem logs"
                    className="btn btn-glass btn-sm text-indigo-300"
                    style={{ padding: '8px' }}
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={() => loadEnv(app)}
                    title="Sửa cấu hình .env"
                    className="btn btn-glass btn-sm text-gray-300"
                    style={{ padding: '8px' }}
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(app.name)}
                    title="Xóa ứng dụng"
                    className="btn btn-glass btn-sm text-red-500 hover:bg-red-500/20"
                    style={{ padding: '8px' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Logs Modal */}
      {selectedAppLogs && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h2>Logs ứng dụng: {selectedAppLogs}</h2>
              <button onClick={() => setSelectedAppLogs(null)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <div className="bg-black/60 font-mono text-xs text-gray-300 p-4 rounded-lg" style={{ height: '350px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {logsLoading ? 'Đang tải log...' : logsText}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => viewLogs(selectedAppLogs)} className="btn btn-glass">Tải lại Logs</button>
              <button onClick={() => setSelectedAppLogs(null)} className="btn btn-primary">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Env Configurations Modal */}
      {selectedAppEnv && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px' }}>
            <div className="modal-header">
              <h2>Cấu hình .env: {selectedAppEnv.name}</h2>
              <button onClick={() => setSelectedAppEnv(null)} className="modal-close-btn">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveEnv(); }}>
              <div className="modal-body space-y-3" style={{ maxHeight: '50vh' }}>
                {envLoading ? (
                  <div className="text-center py-8 text-gray-400">Đang đọc tệp .env...</div>
                ) : (
                  envPairs.map((p, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="KEY (VD: DATABASE_URL)"
                        value={p.key}
                        onChange={(e) => {
                          const newPairs = [...envPairs];
                          newPairs[idx].key = e.target.value;
                          setEnvPairs(newPairs);
                        }}
                        className="input-glass font-mono text-xs"
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        placeholder="VALUE"
                        value={p.val}
                        onChange={(e) => {
                          const newPairs = [...envPairs];
                          newPairs[idx].val = e.target.value;
                          setEnvPairs(newPairs);
                        }}
                        className="input-glass font-mono text-xs"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEnvPairs(envPairs.filter((_, i) => i !== idx));
                        }}
                        className="btn btn-glass text-red-400"
                        style={{ padding: '6px 10px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
                {!envLoading && (
                  <button
                    type="button"
                    onClick={() => setEnvPairs([...envPairs, { key: '', val: '' }])}
                    className="btn btn-glass text-indigo-300 text-xs"
                  >
                    + Thêm dòng mới
                  </button>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedAppEnv(null)} className="btn btn-glass">Hủy bỏ</button>
                <button type="submit" className="btn btn-primary">Lưu & Restart App</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create App Wizard Modal */}
      {showWizard && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '500px' }}>
            <div className="modal-header">
              <h2>Trình tạo App NodeJS nhanh</h2>
              <button onClick={() => setShowWizard(false)} className="modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleCreateApp}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label>Tên ứng dụng</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: smart-api"
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                    className="input-glass"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="form-group flex-1">
                    <label>Cổng Port</label>
                    <input
                      type="number"
                      required
                      placeholder="3000"
                      value={newAppPort}
                      onChange={(e) => setNewAppPort(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Template mẫu</label>
                    <select
                      value={newAppTemplate}
                      onChange={(e) => setNewAppTemplate(e.target.value)}
                      className="input-glass"
                    >
                      <option value="express-api">Express API (JSON)</option>
                      <option value="web-dashboard">Web UI Dashboard</option>
                      <option value="static-site">Trang tĩnh HTML</option>
                      <option value="custom">Tùy biến trống</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Mô tả ứng dụng</label>
                  <input
                    type="text"
                    placeholder="Ứng dụng NodeJS của tôi"
                    value={newAppDesc}
                    onChange={(e) => setNewAppDesc(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowWizard(false)} className="btn btn-glass">Đóng</button>
                <button type="submit" className="btn btn-primary">Bắt đầu tạo & Deploy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

