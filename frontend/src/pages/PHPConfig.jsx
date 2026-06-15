import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { 
  Settings, 
  RotateCw, 
  Save, 
  Sliders, 
  ShieldCheck, 
  Cpu, 
  AlertTriangle,
  Info
} from 'lucide-react';

export default function PHPConfig() {
  const { apiCall, showToast, isConnected, currentVPS } = useVPS();
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const [installingId, setInstallingId] = useState(null);
  
  // Tab control
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'rawConfig' | 'versions'

  // php.ini Config state
  const [phpVersion, setPhpVersion] = useState('');
  const [iniPath, setIniPath] = useState('');
  const [memoryLimit, setMemoryLimit] = useState('128M');
  const [uploadMaxFilesize, setUploadMaxFilesize] = useState('2M');
  const [postMaxSize, setPostMaxSize] = useState('8M');
  const [maxExecutionTime, setMaxExecutionTime] = useState('30');
  const [displayErrors, setDisplayErrors] = useState(false);

  // Raw php.ini state
  const [rawContent, setRawContent] = useState('');
  const [rawLoading, setRawLoading] = useState(false);
  const [savingRaw, setSavingRaw] = useState(false);

  // Extensions list state
  const [extensions, setExtensions] = useState([]);

  // PHP Versions state
  const [phpVersionsList, setPhpVersionsList] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [actionVersion, setActionVersion] = useState(null);
  const [actionType, setActionType] = useState(''); // 'install' | 'default'

  // Load versions list on load
  useEffect(() => {
    if (isConnected) {
      loadPHPVersions();
      loadExtensions();
    }
  }, [isConnected, currentVPS]);

  // Load config when selected version changes
  useEffect(() => {
    if (isConnected && selectedVersion) {
      if (activeTab === 'config') {
        loadPHPConfig(selectedVersion);
      } else if (activeTab === 'rawConfig') {
        loadRawPHPConfig(selectedVersion);
      }
    }
  }, [selectedVersion, activeTab, isConnected, currentVPS]);

  const loadRawPHPConfig = async (version) => {
    setRawLoading(true);
    try {
      const res = await apiCall('/api/php/config/raw/get', 'POST', { version });
      if (res.success && res.data) {
        setRawContent(res.data.content || '');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải cấu hình php.ini thô: ' + err.message, 'error');
    } finally {
      setRawLoading(false);
    }
  };

  const handleSaveRawConfig = async (e) => {
    e.preventDefault();
    setSavingRaw(true);
    try {
      await apiCall('/api/php/config/raw/save', 'POST', {
        path: iniPath,
        content: rawContent
      });
      showToast('Đã lưu cấu hình php.ini và khởi động lại PHP-FPM thành công!', 'success');
      loadRawPHPConfig(selectedVersion);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRaw(false);
    }
  };

  const loadPHPVersions = async () => {
    try {
      const res = await apiCall('/api/php/versions/list', 'POST');
      if (res.success && res.data) {
        setPhpVersionsList(res.data);
        
        // Auto-select default CLI or first installed version
        const defaultVer = res.data.find(v => v.isDefault);
        const installedVer = res.data.find(v => v.installed);
        
        if (defaultVer) {
          setSelectedVersion(defaultVer.version);
        } else if (installedVer) {
          setSelectedVersion(installedVer.version);
        } else {
          // Default fallback
          setSelectedVersion('');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải danh sách phiên bản PHP: ' + err.message, 'error');
    }
  };

  const loadPHPConfig = async (version) => {
    setLoading(true);
    try {
      const configRes = await apiCall('/api/php/config/get', 'POST', { version });
      if (configRes.success && configRes.data) {
        const d = configRes.data;
        setPhpVersion(d.VERSION || 'N/A');
        setIniPath(d.PATH || 'N/A');
        setMemoryLimit(d.MEMORY_LIMIT || '128M');
        setUploadMaxFilesize(d.UPLOAD_MAX_FILESIZE || '2M');
        setPostMaxSize(d.POST_MAX_SIZE || '8M');
        setMaxExecutionTime(d.MAX_EXECUTION_TIME || '30');
        setDisplayErrors(d.DISPLAY_ERRORS?.toLowerCase() === 'on');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải cấu hình PHP: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadExtensions = async () => {
    setExtensionsLoading(true);
    try {
      const extRes = await apiCall('/api/php/extensions/list', 'POST');
      if (extRes.success) {
        setExtensions(extRes.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExtensionsLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await apiCall('/api/php/config/save', 'POST', {
        path: iniPath,
        version: selectedVersion,
        memory_limit: memoryLimit,
        upload_max_filesize: uploadMaxFilesize,
        post_max_size: postMaxSize,
        max_execution_time: parseInt(maxExecutionTime),
        display_errors: displayErrors ? 'On' : 'Off'
      });
      showToast('Đã cập nhật cấu hình php.ini và tải lại PHP-FPM thành công!', 'success');
      loadPHPConfig(selectedVersion);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleInstallExtension = async (extId, extName) => {
    if (!window.confirm(`Bạn có chắc muốn tiến hành cài đặt tiện ích PHP "${extName}"?`)) return;
    
    setInstallingId(extId);
    showToast(`Đang chạy tiến trình cài đặt tiện ích ${extName}...`, 'info');
    try {
      const res = await apiCall('/api/php/extensions/install', 'POST', { id: extId });
      if (res.success) {
        showToast(`Cài đặt tiện ích ${extName} thành công!`, 'success');
        loadExtensions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstallingId(null);
    }
  };

  const handleInstallPHP = async (version) => {
    if (!window.confirm(`Bạn có chắc muốn tiến hành cài đặt PHP ${version}? Tiến trình này có thể mất vài phút.`)) return;
    
    setActionVersion(version);
    setActionType('install');
    showToast(`Đang tiến hành cài đặt PHP ${version} (FPM & CLI)...`, 'info');
    try {
      const res = await apiCall('/api/php/versions/install', 'POST', { version });
      if (res.success) {
        showToast(res.message || `Cài đặt PHP ${version} thành công!`, 'success');
        await loadPHPVersions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionVersion(null);
      setActionType('');
    }
  };

  const handleSetDefaultPHP = async (version) => {
    setActionVersion(version);
    setActionType('default');
    try {
      const res = await apiCall('/api/php/versions/set-default', 'POST', { version });
      if (res.success) {
        showToast(res.message || `Đã đổi PHP mặc định CLI sang PHP ${version}!`, 'success');
        await loadPHPVersions();
        setSelectedVersion(version);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionVersion(null);
      setActionType('');
    }
  };

  const handleRefreshAll = async () => {
    setLoading(true);
    await loadPHPVersions();
    await loadExtensions();
    if (selectedVersion) {
      await loadPHPConfig(selectedVersion);
    }
    setLoading(false);
  };

  const installedVersions = phpVersionsList.filter(v => v.installed);

  return (
    <div className="content-area">
      <Topbar title="QUẢN LÝ PHP">
        <button className="btn btn-primary" onClick={handleRefreshAll} disabled={loading || extensionsLoading}>
          <RotateCw size={14} className={(loading || extensionsLoading) ? 'animate-spin' : ''} /> Làm mới
        </button>
      </Topbar>

      <div className="explorer-header" style={{ marginBottom: '16px' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-outfit">
            <Settings size={24} className="text-indigo-400" />
            Cấu hình & Phiên bản PHP
          </h1>
          <p className="text-sm text-gray-400">
            Quản lý, cài đặt nhiều phiên bản PHP, chỉnh sửa thông số xử lý (php.ini) và cài đặt các tiện ích mở rộng mở rộng.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="db-tabs-container">
        <button 
          onClick={() => setActiveTab('config')}
          className={`db-tab-item ${activeTab === 'config' ? 'active' : ''}`}
        >
          Cấu hình & Extensions
        </button>
        <button 
          onClick={() => setActiveTab('rawConfig')}
          className={`db-tab-item ${activeTab === 'rawConfig' ? 'active' : ''}`}
        >
          Cấu hình php.ini Thô
        </button>
        <button 
          onClick={() => setActiveTab('versions')}
          className={`db-tab-item ${activeTab === 'versions' ? 'active' : ''}`}
        >
          Quản lý Phiên bản PHP
        </button>
      </div>

      {activeTab === 'config' && (
        <>
          {loading && !selectedVersion ? (
            <div className="card-glass p-8 text-center text-gray-400">
              <RotateCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
              Đang quét hệ thống và tải cấu hình PHP...
            </div>
          ) : installedVersions.length === 0 ? (
            <div className="db-warning-card">
              <AlertTriangle className="db-warning-icon text-yellow-500" size={24} />
              <div className="db-warning-text">
                <strong className="db-warning-title text-yellow-400" style={{ fontSize: '14px' }}>
                  PHP chưa được cài đặt trên VPS này!
                </strong>
                <p className="text-gray-400" style={{ marginTop: '4px' }}>
                  Vui lòng chuyển tới tab <strong>Quản lý Phiên bản PHP</strong> để tiến hành cài đặt phiên bản PHP đầu tiên.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }}>
              
              {/* CỘT 1: CẤU HÌNH php.ini */}
              <div className="space-y-6">
                <div className="card-glass p-6 rounded-xl space-y-4">
                  <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                    <Sliders className="text-indigo-400" size={18} />
                    Chỉnh sửa php.ini (PHP-FPM)
                  </h2>

                  {/* Selector phiên bản */}
                  <div className="form-group">
                    <label className="text-xs text-gray-400 block mb-1">Phiên bản PHP cấu hình:</label>
                    <select
                      value={selectedVersion}
                      onChange={e => setSelectedVersion(e.target.value)}
                      className="input-glass w-full"
                      style={{ padding: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                    >
                      {installedVersions.map(v => (
                        <option key={v.version} value={v.version} style={{ background: '#1e1e24', color: '#fff' }}>
                          PHP {v.version} {v.isDefault ? '(Mặc định CLI)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* PHP Information */}
                  <div className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1.5 text-xs text-gray-300">
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Phiên bản PHP cấu hình:</span>
                      <strong className="text-green-400">PHP {phpVersion}</strong>
                    </div>
                    <div className="flex justify-between items-start" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tệp tin cấu hình (Loaded php.ini):</span>
                      <code className="text-indigo-300 break-all font-mono text-[10px] text-right" style={{ maxWidth: '60%' }}>{iniPath}</code>
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center text-gray-400 text-xs">
                      <RotateCw size={18} className="animate-spin mx-auto mb-2 text-indigo-500" />
                      Đang tải cấu hình php.ini...
                    </div>
                  ) : (
                    <form onSubmit={handleSaveConfig} className="space-y-4">
                      <div className="form-group">
                        <label className="text-xs text-gray-400">Giới hạn Bộ nhớ (memory_limit)</label>
                        <input
                          type="text"
                          required
                          placeholder="vd: 256M, 512M"
                          value={memoryLimit}
                          onChange={e => setMemoryLimit(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                        <small className="text-[10px] text-gray-500 block leading-tight mt-1">Dung lượng bộ nhớ RAM tối đa một script PHP được phép sử dụng.</small>
                      </div>

                      <div className="form-group">
                        <label className="text-xs text-gray-400">File tải lên tối đa (upload_max_filesize)</label>
                        <input
                          type="text"
                          required
                          placeholder="vd: 20M, 100M"
                          value={uploadMaxFilesize}
                          onChange={e => setUploadMaxFilesize(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                        <small className="text-[10px] text-gray-500 block leading-tight mt-1">Dung lượng tối đa của 1 tệp tin được phép tải lên.</small>
                      </div>

                      <div className="form-group">
                        <label className="text-xs text-gray-400">Dữ liệu POST tối đa (post_max_size)</label>
                        <input
                          type="text"
                          required
                          placeholder="vd: 20M, 100M"
                          value={postMaxSize}
                          onChange={e => setPostMaxSize(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                        <small className="text-[10px] text-gray-500 block leading-tight mt-1">Tổng dung lượng tối đa cho 1 yêu cầu gửi đi (phải bằng hoặc lớn hơn upload_max_filesize).</small>
                      </div>

                      <div className="form-group">
                        <label className="text-xs text-gray-400">Thời gian chạy tối đa (max_execution_time)</label>
                        <input
                          type="number"
                          required
                          placeholder="vd: 30, 120"
                          value={maxExecutionTime}
                          onChange={e => setMaxExecutionTime(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                        <small className="text-[10px] text-gray-500 block leading-tight mt-1">Thời gian chạy tối đa (giây) của một script trước khi bị ngắt.</small>
                      </div>

                      <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-1">
                        <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-300 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={displayErrors} 
                            onChange={e => setDisplayErrors(e.target.checked)}
                            className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                          />
                          Hiển thị lỗi PHP ra ngoài Web (display_errors)
                        </label>
                        <p className="text-[10px] text-gray-400 pl-6 leading-normal">
                          Chỉ bật khi gỡ lỗi hoặc phát triển website. Nên tắt ở môi trường chạy thật để tránh rò rỉ mã nguồn/đường dẫn nhạy cảm.
                        </p>
                      </div>

                      <button 
                        type="submit" 
                        disabled={savingConfig}
                        className="btn btn-primary btn-block flex items-center justify-center gap-2"
                        style={{ padding: '10px' }}
                      >
                        <Save size={16} />
                        {savingConfig ? 'Đang áp dụng...' : 'Lưu cấu hình & Restart PHP-FPM'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* CỘT 2: DANH SÁCH TIỆN ÍCH EXTENSIONS */}
              <div className="space-y-6">
                <div className="card-glass p-6 rounded-xl space-y-4">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                      <ShieldCheck className="text-green-400" size={18} />
                      Thư viện tiện ích PHP Extensions
                    </h2>
                    <button className="btn btn-glass btn-xs" onClick={loadExtensions} disabled={extensionsLoading}>
                      <RotateCw size={10} className={extensionsLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {extensionsLoading ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      <RotateCw size={18} className="animate-spin mx-auto mb-2 text-green-500" />
                      Đang quét danh sách extensions...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {extensions.map(ext => (
                        <div key={ext.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col justify-between" style={{ display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="font-bold text-gray-200 text-sm">{ext.name}</span>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                                ext.installed 
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                  : 'bg-white/5 text-gray-400 border border-white/5'
                              }`}>
                                {ext.installed ? 'ĐÃ CÀI' : 'CHƯA CÀI'}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-normal" style={{ fontSize: '10px' }}>{ext.desc}</p>
                          </div>
                          <div className="pt-3">
                            <button
                              onClick={() => handleInstallExtension(ext.id, ext.name)}
                              disabled={ext.installed || installingId !== null}
                              className={`btn btn-block py-1 text-[10px] font-bold ${
                                ext.installed 
                                  ? 'btn-secondary text-gray-500 border-none cursor-default' 
                                  : 'btn-primary'
                              }`}
                              style={{ padding: '4px', fontSize: '10px' }}
                            >
                              {installingId === ext.id ? 'Đang cài...' : ext.installed ? 'Đã hoạt động' : 'Cài đặt ngay'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {activeTab === 'rawConfig' && (
        installedVersions.length === 0 ? (
          <div className="db-warning-card">
            <AlertTriangle className="db-warning-icon text-yellow-500" size={24} />
            <div className="db-warning-text">
              <strong className="db-warning-title text-yellow-400" style={{ fontSize: '14px' }}>
                PHP chưa được cài đặt trên VPS này!
              </strong>
            </div>
          </div>
        ) : (
          <div className="card-glass p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <Sliders className="text-indigo-400" size={18} />
                  Trình biên tập php.ini Thô (Raw Editor)
                </h2>
                <p className="text-xs text-gray-400">Đường dẫn tệp cấu hình: <code className="text-indigo-300 font-mono">{iniPath}</code></p>
              </div>

              {/* Selector phiên bản */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 whitespace-nowrap">Phiên bản:</label>
                <select
                  value={selectedVersion}
                  onChange={e => setSelectedVersion(e.target.value)}
                  className="input-glass"
                  style={{ width: '150px', padding: '6px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                >
                  {installedVersions.map(v => (
                    <option key={v.version} value={v.version} style={{ background: '#1e1e24', color: '#fff' }}>
                      PHP {v.version}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {rawLoading ? (
              <div className="text-center py-20 text-gray-400">
                <RotateCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                Đang tải tệp php.ini thô...
              </div>
            ) : (
              <form onSubmit={handleSaveRawConfig} className="space-y-4">
                <textarea
                  value={rawContent}
                  onChange={e => setRawContent(e.target.value)}
                  className="w-full min-h-[500px] bg-black/55 text-gray-200 font-mono text-xs p-4 rounded-lg outline-none border border-white/10 focus:border-indigo-500/50 resize-y scrollbar-none"
                  placeholder="Nội dung php.ini"
                />
                <button
                  type="submit"
                  disabled={savingRaw}
                  className="btn btn-primary flex items-center justify-center gap-2"
                  style={{ padding: '10px 20px' }}
                >
                  <Save size={16} />
                  {savingRaw ? 'Đang lưu & Khởi động lại FPM...' : 'Lưu cấu hình & Restart PHP-FPM'}
                </button>
              </form>
            )}
          </div>
        )
      )}

      {activeTab === 'versions' && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
            <Info className="text-indigo-400 mt-0.5 flex-shrink-0" size={18} />
            <div className="text-xs text-gray-300 leading-relaxed">
              <strong className="text-indigo-300 block mb-1">Lưu ý quan trọng:</strong>
              Việc thiết lập phiên bản PHP mặc định CLI chỉ ảnh hưởng đến lệnh `php` khi chạy trực tiếp trong terminal (như cron job, composer...). Để website cụ thể chạy với phiên bản PHP mong muốn, bạn cần cấu hình tệp tin cấu hình Nginx/Apache của site trỏ tới socket tương ứng (ví dụ: `unix:/run/php/php8.2-fpm.sock`).
            </div>
          </div>

          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <Cpu className="text-indigo-400" size={18} />
              Quản lý danh sách phiên bản PHP
            </h2>

            <div className="space-y-3">
              {phpVersionsList.map(v => (
                <div key={v.version} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                      <Cpu size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-100 text-sm">PHP {v.version}</span>
                        {v.isDefault && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                            Mặc định CLI
                          </span>
                        )}
                        {v.installed && !v.isDefault && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-white/10 text-gray-300 rounded-full">
                            Đã cài đặt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.installed 
                          ? `Đã cài đặt php${v.version}-fpm và php${v.version}-cli.` 
                          : `Chưa cài đặt. Nhấp nút cài đặt để tải và cấu hình phiên bản này.`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {v.installed ? (
                      <button
                        onClick={() => handleSetDefaultPHP(v.version)}
                        disabled={v.isDefault || actionVersion !== null}
                        className={`btn text-xs ${v.isDefault ? 'btn-secondary text-gray-500 cursor-not-allowed' : 'btn-primary'}`}
                        style={{ padding: '6px 12px' }}
                      >
                        {actionVersion === v.version && actionType === 'default' ? 'Đang đặt...' : 'Đặt làm mặc định CLI'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstallPHP(v.version)}
                        disabled={actionVersion !== null}
                        className="btn btn-glass text-xs hover:bg-indigo-600 hover:text-white"
                        style={{ padding: '6px 12px' }}
                      >
                        {actionVersion === v.version && actionType === 'install' ? 'Đang cài đặt...' : 'Cài đặt'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
