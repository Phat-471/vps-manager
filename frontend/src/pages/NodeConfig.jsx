
import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import {
  Cpu,
  RotateCw,
  Check,
  Download,
  AlertTriangle,
  Info,
  Globe,
  Terminal,
  Server
} from 'lucide-react';

export default function NodeConfig() {
  const { apiCall, showToast, isConnected, currentVPS } = useVPS();
  const [loading, setLoading] = useState(false);
  const [nvmStatus, setNvmStatus] = useState({
    nvmInstalled: false,
    nvmVersion: '',
    nodeVersion: '',
    npmVersion: '',
    pm2Installed: false,
    pm2Version: '',
    pm2StartupEnabled: false
  });

  const [versionsData, setVersionsData] = useState({
    current: '',
    default: '',
    installed: [],
    remoteLts: [
      { version: 'v22.11.0', ltsLabel: 'Jod' },
      { version: 'v20.18.0', ltsLabel: 'Iron' },
      { version: 'v18.20.4', ltsLabel: 'Hydrogen' },
      { version: 'v16.20.2', ltsLabel: 'Gallium' },
      { version: 'v14.21.3', ltsLabel: 'Fermium' }
    ]
  });

  const [installingNvm, setInstallingNvm] = useState(false);
  const [actionVersion, setActionVersion] = useState(null);
  const [actionType, setActionType] = useState(''); // 'install' | 'default' | 'pm2'
  const [customVersion, setCustomVersion] = useState('');

  useEffect(() => {
    if (isConnected) {
      checkNvmStatus();
    }
  }, [isConnected, currentVPS]);

  const checkNvmStatus = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/node/status', 'POST');
      if (res.success && res.data) {
        setNvmStatus(res.data);
        if (res.data.nvmInstalled) {
          await loadVersions();
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kiểm tra trạng thái NVM: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const res = await apiCall('/api/node/versions/list', 'POST');
      if (res.success && res.data) {
        setVersionsData(res.data);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải danh sách phiên bản Node.js: ' + err.message, 'error');
    }
  };

  const handleInstallNVM = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn cài đặt NVM (Node Version Manager) trên máy chủ này?')) return;

    setInstallingNvm(true);
    showToast('Đang tiến hành tải và cài đặt NVM...', 'info');
    try {
      const res = await apiCall('/api/node/install-nvm', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
        await checkNvmStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstallingNvm(false);
    }
  };

  const handleInstallNode = async (version) => {
    if (!version) return;
    if (!window.confirm(`Bạn có chắc chắn muốn tải và cài đặt Node.js phiên bản ${version}?`)) return;

    setActionVersion(version);
    setActionType('install');
    showToast(`Đang chạy tiến trình cài đặt Node.js ${version}...`, 'info');
    try {
      const res = await apiCall('/api/node/versions/install', 'POST', { version });
      if (res.success) {
        showToast(res.message, 'success');
        await loadVersions();
        await checkNvmStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionVersion(null);
      setActionType('');
    }
  };

  const handleSetDefaultNode = async (version) => {
    if (!version) return;
    setActionVersion(version);
    setActionType('default');
    try {
      const res = await apiCall('/api/node/versions/set-default', 'POST', { version });
      if (res.success) {
        showToast(res.message, 'success');
        await loadVersions();
        await checkNvmStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionVersion(null);
      setActionType('');
    }
  };

  const handleUninstallNode = async (version) => {
    if (!version) return;
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ cài đặt Node.js phiên bản ${version}?`)) return;

    setActionVersion(version);
    setActionType('uninstall');
    showToast(`Đang chạy tiến trình gỡ cài đặt Node.js ${version}...`, 'info');
    try {
      const res = await apiCall('/api/node/versions/uninstall', 'POST', { version });
      if (res.success) {
        showToast(res.message, 'success');
        await loadVersions();
        await checkNvmStatus();
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi gỡ cài đặt Node.js: ' + err.message, 'error');
    } finally {
      setActionVersion(null);
      setActionType('');
    }
  };

  const handleCustomInstall = (e) => {
    e.preventDefault();
    if (!customVersion.trim()) return;
    handleInstallNode(customVersion.trim());
    setCustomVersion('');
  };

  const handleTogglePM2Startup = async (action) => {
    setLoading(true);
    try {
      const res = await apiCall('/api/node/pm2/startup', 'POST', { action });
      if (res.success) {
        showToast(res.message, 'success');
        await checkNvmStatus();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await checkNvmStatus();
  };

  return (
    <div className="content-area">
      <Topbar title="QUẢN LÝ NODE.JS">
        <button className="btn btn-primary" onClick={handleRefresh} disabled={loading}>
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </Topbar>

      <div className="explorer-header" style={{ marginBottom: '16px' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-outfit">
            <Cpu size={24} className="text-indigo-400" />
            Quản lý Phiên bản Node.js (NVM)
          </h1>
          <p className="text-sm text-gray-400">
            Cài đặt, quản lý và chuyển đổi nhanh giữa các phiên bản Node.js sử dụng NVM trực tiếp trên máy chủ.
          </p>
        </div>
      </div>

      {loading && !nvmStatus.nvmVersion ? (
        <div className="card-glass p-8 text-center text-gray-400">
          <RotateCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang quét môi trường Node.js trên VPS...
        </div>
      ) : !nvmStatus.nvmInstalled ? (
        /* GIAO DIỆN CHƯA CÀI NVM */
        <div className="space-y-6">
          <div className="db-warning-card">
            <AlertTriangle className="db-warning-icon text-yellow-500" size={24} />
            <div className="db-warning-text">
              <strong className="db-warning-title text-yellow-400" style={{ fontSize: '14px' }}>
                NVM (Node Version Manager) chưa được cài đặt trên VPS này!
              </strong>
              <p className="text-gray-400" style={{ marginTop: '4px' }}>
                Để quản lý nhiều phiên bản Node.js và npm một cách linh hoạt, hệ thống cần sử dụng NVM.
              </p>
            </div>
          </div>

          <div className="card-glass p-8 rounded-xl text-center max-w-xl mx-auto space-y-6" style={{ marginTop: '20px' }}>
            <div className="p-4 bg-indigo-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-indigo-400">
              <Server size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-200">Cài đặt NVM Tự động</h2>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                Hệ thống sẽ tải và cài đặt NVM bản mới nhất, tự động thiết lập các biến môi trường cấu hình và chuẩn bị sẵn sàng cho Node.js engine.
              </p>
            </div>

            <button
              onClick={handleInstallNVM}
              disabled={installingNvm}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 font-semibold"
              style={{ maxWidth: '300px', margin: '0 auto' }}
            >
              <Download size={18} />
              {installingNvm ? 'Đang cài đặt NVM...' : 'Cài đặt NVM 1-Click'}
            </button>
          </div>
        </div>
      ) : (
        /* GIAO DIỆN ĐÃ CÀI NVM */
        <div className="space-y-6">
          {/* Dashboard Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card-glass p-5 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Terminal size={22} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">NVM Version</span>
                <span className="font-bold text-gray-100 text-lg">{nvmStatus.nvmVersion}</span>
              </div>
            </div>

            <div className="card-glass p-5 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-green-400">
                <Cpu size={22} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Active Node</span>
                <span className="font-bold text-gray-100 text-lg">{nvmStatus.nodeVersion}</span>
              </div>
            </div>

            <div className="card-glass p-5 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400">
                <Globe size={22} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Active NPM</span>
                <span className="font-bold text-gray-100 text-lg">{nvmStatus.npmVersion}</span>
              </div>
            </div>

            <div className="card-glass p-5 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                <Check size={22} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block uppercase tracking-wider font-semibold">Default Alias</span>
                <span className="font-bold text-gray-100 text-lg">{versionsData.default || 'none'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
            <Info className="text-indigo-400 mt-0.5 flex-shrink-0" size={18} />
            <div className="text-xs text-gray-300 leading-relaxed">
              <strong className="text-indigo-300 block mb-1">Cơ chế Symlink liên kết Hệ thống:</strong>
              Khi bạn đặt một phiên bản Node làm mặc định, VPS Manager sẽ tự động cập nhật liên kết symlink trong `/usr/bin/node` và `/usr/bin/npm`. Điều này đảm bảo các công cụ chạy nền (như PM2 daemon) hay tiến trình Cron Job có thể tìm thấy và chạy đúng phiên bản Node.js đó mà không bị lỗi thiếu môi trường.
            </div>
          </div>

          {/* PM2 Daemon autostart configuration */}
          {nvmStatus.pm2Installed ? (
            <div className="card-glass p-5 rounded-xl border border-white/5 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                    <Server size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-200 text-sm">Cấu hình PM2 Daemon (Tự khởi chạy cùng hệ điều hành)</h3>
                    <p className="text-[11px] text-gray-400">PM2 v{nvmStatus.pm2Version} - Đảm bảo các ứng dụng Node.js tự động khôi phục sau khi reboot VPS.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${nvmStatus.pm2StartupEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {nvmStatus.pm2StartupEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </span>
                  
                  {nvmStatus.pm2StartupEnabled ? (
                    <button
                      onClick={() => handleTogglePM2Startup('disable')}
                      disabled={loading}
                      className="btn btn-danger text-xs font-semibold py-1.5 px-3 rounded-lg"
                    >
                      Tắt khởi động cùng OS
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTogglePM2Startup('enable')}
                      disabled={loading}
                      className="btn btn-primary text-xs font-semibold py-1.5 px-3 rounded-lg"
                    >
                      Bật khởi động cùng OS
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card-glass p-5 rounded-xl border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-400">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-200 text-sm">PM2 chưa được cài đặt trên VPS này</h3>
                  <p className="text-[11px] text-gray-400">Hãy cài đặt PM2 bằng cách triển khai một Node.js App hoặc cài thông qua mục dịch vụ hệ thống.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>

            {/* CỘT TRÁI: PHIÊN BẢN ĐÃ CÀI ĐẶT CỤC BỘ */}
            <div className="space-y-6">
              <div className="card-glass p-6 rounded-xl space-y-4">
                <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <Cpu className="text-green-400" size={18} />
                  Phiên bản đã cài đặt cục bộ (Local)
                </h2>

                <div className="space-y-3">
                  {versionsData.installed.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Chưa có phiên bản Node.js nào được cài đặt.</p>
                  ) : (
                    versionsData.installed.map(v => {
                      const isActive = nvmStatus.nodeVersion === v.version || `v${nvmStatus.nodeVersion}` === v.version;
                      const isDefault = versionsData.default === v.version || `v${versionsData.default}` === v.version;
                      return (
                        <div key={v.version} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                              <Cpu size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-200 text-sm">{v.version}</span>
                                {isActive && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                                    Đang dùng
                                  </span>
                                )}
                                {isDefault && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">
                                    Mặc định
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleSetDefaultNode(v.version)}
                              disabled={isDefault || actionVersion !== null}
                              className={`btn text-xs ${isDefault ? 'btn-secondary text-gray-500 cursor-not-allowed' : 'btn-primary'}`}
                              style={{ padding: '6px 12px' }}
                            >
                              {actionVersion === v.version && actionType === 'default' ? (
                                <span className="flex items-center gap-1">
                                  <RotateCw size={12} className="animate-spin" /> Đang đặt...
                                </span>
                              ) : 'Mặc định'}
                            </button>
                            <button
                              onClick={() => handleUninstallNode(v.version)}
                              disabled={isDefault || actionVersion !== null}
                              className={`btn text-xs ${isDefault ? 'btn-secondary text-gray-500' : 'btn-danger'}`}
                              style={{ padding: '6px 12px' }}
                            >
                              {actionVersion === v.version && actionType === 'uninstall' ? (
                                <span className="flex items-center gap-1">
                                  <RotateCw size={12} className="animate-spin" /> Đang gỡ...
                                </span>
                              ) : 'Gỡ'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Form cài đặt phiên bản tùy chọn */}
                <div className="pt-4 border-t border-white/5">
                  <form onSubmit={handleCustomInstall} className="space-y-3">
                    <label className="text-xs text-gray-400 block font-semibold">Cài đặt phiên bản Node.js tùy chỉnh:</label>
                    <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ví dụ: 18.16.0 hoặc 21"
                        value={customVersion}
                        onChange={e => setCustomVersion(e.target.value)}
                        className="input-glass flex-grow"
                        style={{ padding: '8px', fontSize: '12px' }}
                      />
                      <button
                        type="submit"
                        disabled={actionVersion !== null || !customVersion.trim()}
                        className="btn btn-primary flex items-center gap-1.5 text-xs font-semibold"
                        style={{ padding: '8px 16px' }}
                      >
                        {actionVersion !== null ? (
                          <span className="flex items-center gap-1">
                            <RotateCw size={12} className="animate-spin" /> Đang tải...
                          </span>
                        ) : (
                          <>
                            <Download size={14} /> Tải & Cài đặt
                          </>
                        )}
                      </button>
                    </div>
                    <small className="text-[10px] text-gray-500 block leading-tight">Bạn có thể điền mã phiên bản (vd: 16.20.0), số chính (vd: 20) hoặc nhãn LTS (vd: lts/iron).</small>
                  </form>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: PHIÊN BẢN LTS TỪ XA */}
            <div className="space-y-6">
              <div className="card-glass p-6 rounded-xl space-y-4">
                <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <Globe className="text-indigo-400" size={18} />
                  Phiên bản LTS từ xa (1-Click Install)
                </h2>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  {versionsData.remoteLts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Đang truy vấn danh sách từ xa...</p>
                  ) : (
                    versionsData.remoteLts.map(v => {
                      const isInstalled = versionsData.installed.some(inst => inst.version === v.version);
                      return (
                        <div key={v.version} className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all">
                          <div>
                            <span className="font-bold text-gray-200 text-sm">{v.version}</span>
                            {v.ltsLabel && (
                              <span className="ml-2 px-1.5 py-0.5 text-[9px] font-semibold bg-white/5 text-gray-400 rounded">
                                LTS: {v.ltsLabel}
                              </span>
                            )}
                          </div>

                          {isInstalled ? (
                            <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                              <Check size={14} /> Đã cài đặt
                            </span>
                          ) : (
                            <button
                              onClick={() => handleInstallNode(v.version)}
                              disabled={actionVersion !== null}
                              className="btn btn-glass text-xs py-1 px-3 hover:bg-indigo-600 hover:text-white"
                              style={{ padding: '4px 10px' }}
                            >
                              {actionVersion === v.version && actionType === 'install' ? (
                                <span className="flex items-center gap-1">
                                  <RotateCw size={12} className="animate-spin" /> Đang cài...
                                </span>
                              ) : 'Cài đặt'}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
