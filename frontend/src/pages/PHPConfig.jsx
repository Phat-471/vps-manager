import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { 
  Settings, 
  RotateCw, 
  Save, 
  Check, 
  Download, 
  Sliders, 
  ShieldCheck, 
  Folder, 
  Cpu, 
  AlertTriangle 
} from 'lucide-react';

export default function PHPConfig() {
  const { apiCall, showToast, isConnected, currentVPS } = useVPS();
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const [installingId, setInstallingId] = useState(null);

  // php.ini Config state
  const [phpVersion, setPhpVersion] = useState('');
  const [iniPath, setIniPath] = useState('');
  const [memoryLimit, setMemoryLimit] = useState('128M');
  const [uploadMaxFilesize, setUploadMaxFilesize] = useState('2M');
  const [postMaxSize, setPostMaxSize] = useState('8M');
  const [maxExecutionTime, setMaxExecutionTime] = useState('30');
  const [displayErrors, setDisplayErrors] = useState(false);

  // Extensions list state
  const [extensions, setExtensions] = useState([]);

  useEffect(() => {
    if (isConnected) {
      loadPHPData();
    }
  }, [isConnected, currentVPS]);

  const loadPHPData = async () => {
    setLoading(true);
    try {
      // Load configuration
      const configRes = await apiCall('/api/php/config/get', 'POST');
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
      
      // Load extensions
      await loadExtensions();

    } catch (err) {
      console.error(err);
      showToast('Lỗi tải dữ liệu PHP: ' + err.message, 'error');
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
        memory_limit: memoryLimit,
        upload_max_filesize: uploadMaxFilesize,
        post_max_size: postMaxSize,
        max_execution_time: parseInt(maxExecutionTime),
        display_errors: displayErrors ? 'On' : 'Off'
      });
      showToast('Đã cập nhật cấu hình php.ini và tải lại PHP-FPM thành công!', 'success');
      loadPHPData();
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

  return (
    <div className="content-area">
      <Topbar title="CẤU HÌNH & TIỆN ÍCH PHP">
        <button className="btn btn-primary" onClick={loadPHPData} disabled={loading || extensionsLoading}>
          <RotateCw size={14} className={(loading || extensionsLoading) ? 'animate-spin' : ''} /> Làm mới
        </button>
      </Topbar>

      <div className="explorer-header" style={{ marginBottom: '16px' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-outfit">
            <Settings size={24} className="text-indigo-400" />
            Cấu hình & Extension PHP
          </h1>
          <p className="text-sm text-gray-400">
            Tối ưu hóa các thông số xử lý PHP (php.ini) và cài đặt nhanh các thư viện tiện ích (MySQL, Redis, GD...) cho website.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card-glass p-8 text-center text-gray-400">
          <RotateCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang quét hệ thống và tải cấu hình PHP...
        </div>
      ) : !phpVersion || phpVersion === 'N/A' ? (
        <div className="db-warning-card">
          <AlertTriangle className="db-warning-icon text-yellow-500" size={24} />
          <div className="db-warning-text">
            <strong className="db-warning-title text-yellow-400" style={{ fontSize: '14px' }}>
              PHP chưa được cài đặt trên VPS này!
            </strong>
            <p className="text-gray-400" style={{ marginTop: '4px' }}>
              Vui lòng chuyển tới mục <strong>Cài đặt Dịch vụ</strong> hoặc chạy cài đặt <strong>LEMP Stack</strong> trong <strong>Cài nhanh Web/App</strong> để triển khai PHP engine trước khi cấu hình.
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
              
              {/* PHP Information */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1.5 text-xs text-gray-300">
                <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phiên bản PHP hiện tại:</span>
                  <strong className="text-green-400">{phpVersion}</strong>
                </div>
                <div className="flex justify-between items-start" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tệp tin cấu hình (Loaded php.ini):</span>
                  <code className="text-indigo-300 break-all font-mono text-[10px] text-right" style={{ maxWidth: '65%' }}>{iniPath}</code>
                </div>
              </div>

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
                  {savingConfig ? 'Đang áp dụng...' : 'Lưu cấu hình & Restart PHP'}
                </button>
              </form>
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
    </div>
  );
}
