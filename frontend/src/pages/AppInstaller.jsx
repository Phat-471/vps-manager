import React, { useState } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { 
  Rocket, 
  Globe, 
  Mail, 
  Database, 
  Key, 
  AlertTriangle, 
  Info,
  CheckCircle,
  Copy,
  Terminal,
  Loader
} from 'lucide-react';

export default function AppInstaller() {
  const { apiCall, showToast, isConnected } = useVPS();
  const [activeTab, setActiveTab] = useState('wordpress'); // 'wordpress' | 'laravel'
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');

  // Result state
  const [installedData, setInstalledData] = useState(null);
  const [logs, setLogs] = useState('');

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, 'success');
  };

  const handleInstallWordPress = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    setInstalledData(null);
    setLogs('>> Bắt đầu quá trình cài đặt tự động WordPress...\n');

    try {
      const res = await apiCall('/api/installer/wordpress', 'POST', {
        domain: domain.trim(),
        email: email.trim()
      });

      if (res.success) {
        setLogs(prev => prev + `>> THÀNH CÔNG: ${res.message}\n`);
        setInstalledData(res.data);
        showToast('Cài đặt WordPress thành công!', 'success');
      }
    } catch (err) {
      const errMsg = err.response?.data?.details || err.message;
      setLogs(prev => prev + `>> THẤT BẠI: ${errMsg}\n`);
      showToast('Cài đặt WordPress thất bại: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallLaravel = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    setInstalledData(null);
    setLogs('>> Bắt đầu quá trình cài đặt tự động Laravel...\n>> Quá trình này có thể mất 1-2 phút tùy thuộc vào tốc độ mạng để cài đặt Composer Packages...\n');

    try {
      const res = await apiCall('/api/installer/laravel', 'POST', {
        domain: domain.trim()
      });

      if (res.success) {
        setLogs(prev => prev + `>> THÀNH CÔNG: ${res.message}\n`);
        setInstalledData(res.data);
        showToast('Cài đặt Laravel thành công!', 'success');
      }
    } catch (err) {
      const errMsg = err.response?.data?.details || err.message;
      setLogs(prev => prev + `>> THẤT BẠI: ${errMsg}\n`);
      showToast('Cài đặt Laravel thất bại: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-area">
      <Topbar title="TRÌNH CÀI ĐẶT 1-CLICK" />

      <div className="explorer-header" style={{ marginBottom: '16px' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-outfit">
            <Rocket size={24} className="text-indigo-400" />
            Cài đặt Mã nguồn 1-Click
          </h1>
          <p className="text-sm text-gray-400">
            Triển khai nhanh mã nguồn WordPress hoặc Laravel trên VPS mà không cần cấu hình thủ công Nginx, Database hay phân quyền thư mục.
          </p>
        </div>
      </div>

      <div className="db-tabs-container">
        <button 
          onClick={() => { setActiveTab('wordpress'); setInstalledData(null); setLogs(''); }}
          className={`db-tab-item ${activeTab === 'wordpress' ? 'active' : ''}`}
        >
          <span className="fab fa-wordpress text-lg mr-1" style={{ color: '#21759b' }}></span>
          Cài đặt WordPress
        </button>
        <button 
          onClick={() => { setActiveTab('laravel'); setInstalledData(null); setLogs(''); }}
          className={`db-tab-item ${activeTab === 'laravel' ? 'active' : ''}`}
        >
          <span className="fab fa-laravel text-lg mr-1" style={{ color: '#ff2d20' }}></span>
          Cài đặt Laravel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Form panel */}
        <div className="space-y-6">
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              {activeTab === 'wordpress' ? 'WordPress Auto-Installer' : 'Laravel Auto-Installer'}
            </h2>
            
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-2 text-xs text-gray-300">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <span>
                  Hệ thống tự động thiết lập Cơ sở dữ liệu ngẫu nhiên có độ bảo mật cao và cấu hình tối ưu server block cho Nginx.
                </span>
              </div>
            </div>

            <form onSubmit={activeTab === 'wordpress' ? handleInstallWordPress : handleInstallLaravel} className="space-y-4">
              <div className="form-group">
                <label className="text-xs text-gray-400 block mb-1">Tên miền hoạt động (Domain Name):</label>
                <div className="flex items-center input-glass px-3 py-1">
                  <Globe size={14} className="text-gray-500 mr-2" />
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: mywebsite.com"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    disabled={loading}
                    className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                    style={{ background: 'none', border: 'none', padding: '6px 0' }}
                  />
                </div>
                <small className="text-[10px] text-gray-500 block leading-tight mt-1">Đảm bảo tên miền của bạn đã được trỏ (A Record) về IP của VPS này.</small>
              </div>

              {activeTab === 'wordpress' && (
                <div className="form-group">
                  <label className="text-xs text-gray-400 block mb-1">Email quản trị viên (Admin Email):</label>
                  <div className="flex items-center input-glass px-3 py-1">
                    <Mail size={14} className="text-gray-500 mr-2" />
                    <input
                      type="email"
                      placeholder="ví dụ: admin@mywebsite.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={loading}
                      className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                      style={{ background: 'none', border: 'none', padding: '6px 0' }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !domain.trim()}
                className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-semibold text-xs rounded-lg"
              >
                {loading ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Đang tiến hành cài đặt...
                  </>
                ) : (
                  <>
                    <Rocket size={14} />
                    Cài đặt 1-Click ngay
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Success Credentials Display */}
          {installedData && (
            <div className="card-glass p-6 rounded-xl space-y-4 border border-green-500/20 bg-green-500/5 animate-fade-in">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={20} />
                <h3 className="font-bold text-sm">Cài đặt thành công! Thông tin kết nối:</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-black/40 rounded-lg space-y-2 font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Database Name:</span>
                    <span className="text-green-300 flex items-center gap-1">
                      {installedData.dbName}
                      <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.dbName, 'Database Name')} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Database User:</span>
                    <span className="text-green-300 flex items-center gap-1">
                      {installedData.dbUser}
                      <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.dbUser, 'Database User')} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Database Password:</span>
                    <span className="text-green-300 flex items-center gap-1">
                      {installedData.dbPass}
                      <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.dbPass, 'Database Password')} />
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-400">Đường dẫn Website:</span>
                  <a 
                    href={installedData.siteUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-indigo-400 font-semibold underline hover:text-indigo-300"
                  >
                    {installedData.siteUrl}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logs Terminal view */}
        <div className="card-glass p-5 rounded-xl flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
            <Terminal size={16} />
            Tiến trình cài đặt thời gian thực
          </h3>

          <pre className="flex-1 bg-black/60 text-green-400 p-4 font-mono text-xs overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/5">
            {logs || '>> Sẵn sàng. Nhập thông tin và nhấn Cài đặt...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
