import React, { useState, useEffect, useRef } from 'react';
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
  Loader,
  Server,
  Layers,
  StopCircle
} from 'lucide-react';

export default function AppInstaller() {
  const { apiCall, showToast, isConnected, socket, currentVPS } = useVPS();
  const [activeTab, setActiveTab] = useState('wordpress'); // 'wordpress' | 'laravel' | 'phpmyadmin' | 'portainer' | 'nodeapp'
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [installFailed, setInstallFailed] = useState(false);
  
  // Form Inputs
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [appName, setAppName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [port, setPort] = useState('3000');
  const [phpVersion, setPhpVersion] = useState('8.2');
  const [ssl, setSsl] = useState(false);

  // WordPress Advanced Form Inputs
  const [siteTitle, setSiteTitle] = useState('My WordPress Site');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState(() => Math.random().toString(36).substring(2, 14));
  const [dbMode, setDbMode] = useState('auto'); // 'auto' | 'custom'
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPass, setDbPass] = useState('');

  // phpMyAdmin Custom states
  const [pmaPort, setPmaPort] = useState(() => String(Math.floor(Math.random() * (9999 - 8000 + 1)) + 8000));
  const [pmaUser, setPmaUser] = useState('pma_admin');
  const [pmaPassword, setPmaPassword] = useState(() => Math.random().toString(36).substring(2, 12));

  // Result state
  const [installedData, setInstalledData] = useState(null);
  const [logs, setLogs] = useState('');
  
  // phpMyAdmin status states
  const [pmaStatus, setPmaStatus] = useState({ installed: false, enabled: false, port: '8888' });
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [showPmaForm, setShowPmaForm] = useState(false);

  // Refs
  const logEndRef = useRef(null);
  const preparedDataRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchPmaStatus = async () => {
    if (!currentVPS) return;
    setFetchingStatus(true);
    try {
      const res = await apiCall('/api/installer/phpmyadmin/toggle', 'POST', {
        vpsConfig: currentVPS,
        action: 'status'
      });
      if (res.success) {
        setPmaStatus({
          installed: res.installed,
          enabled: res.enabled,
          port: res.port || '8888'
        });
      }
    } catch (err) {
      console.error('Lỗi khi tải trạng thái phpMyAdmin:', err);
    } finally {
      setFetchingStatus(false);
    }
  };

  const handleTogglePma = async (action) => {
    if (!currentVPS) return;
    setLoading(true);
    try {
      const res = await apiCall('/api/installer/phpmyadmin/toggle', 'POST', {
        vpsConfig: currentVPS,
        action: action
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchPmaStatus();
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'phpmyadmin' && isConnected && currentVPS) {
      fetchPmaStatus();
    }
  }, [activeTab, isConnected, currentVPS]);

  // Handle Socket Events for task stream
  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data) => {
      setLogs(prev => prev + data);
    };

    const handleEnded = ({ code, error }) => {
      setLoading(false);
      setRunning(false);
      if (code === 0) {
        setInstallFailed(false);
        setLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] THÀNH CÔNG: Quá trình cài đặt ứng dụng đã hoàn tất!\n`);
        setInstalledData(preparedDataRef.current);
        showToast('Cài đặt ứng dụng thành công!', 'success');
        if (activeTab === 'phpmyadmin') {
          fetchPmaStatus();
          setShowPmaForm(false);
        }
      } else {
        setInstallFailed(true);
        const errMsg = error || `Mã lỗi trả về: ${code}`;
        setLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] THẤT BẠI: ${errMsg}\n`);
        showToast('Cài đặt ứng dụng thất bại: ' + errMsg, 'error');
      }
    };

    socket.on('task:output', handleOutput);
    socket.on('task:ended', handleEnded);

    return () => {
      socket.off('task:output', handleOutput);
      socket.off('task:ended', handleEnded);
    };
  }, [socket, activeTab, currentVPS]);

  const handleCopyErrorReport = () => {
    const reportText = `=== BÁO CÁO LỖI CÀI ĐẶT VPS MANAGER ===
Thời gian: ${new Date().toLocaleString()}
VPS IP/Host: ${currentVPS?.host || 'N/A'}
Tác vụ: Cài đặt ${activeTab.toUpperCase()}
Tên miền: ${domain || 'N/A'}
Cổng: ${port || pmaPort || 'N/A'}

--- NHẬT KÝ CHI TIẾT (LOGS) ---
${logs}
======================================`;
    navigator.clipboard.writeText(reportText);
    showToast('Đã sao chép báo cáo lỗi! Hãy gửi nội dung này cho kỹ thuật viên qua Zalo/Telegram.', 'success');
  };

  const handleDownloadLog = () => {
    const reportText = `=== BÁO CÁO LỖI CÀI ĐẶT VPS MANAGER ===
Thời gian: ${new Date().toLocaleString()}
VPS IP/Host: ${currentVPS?.host || 'N/A'}
Tác vụ: Cài đặt ${activeTab.toUpperCase()}
Tên miền: ${domain || 'N/A'}
Cổng: ${port || pmaPort || 'N/A'}

--- NHẬT KÝ CHI TIẾT (LOGS) ---
${logs}
======================================`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error_report_${activeTab}_${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file log thành công!', 'success');
  };

  const handleTabChange = (tab) => {
    if (running) {
      if (!window.confirm('Tiến trình cài đặt hiện tại đang chạy. Thay đổi tab sẽ không dừng tiến trình. Bạn có chắc chắn?')) {
        return;
      }
    }
    setActiveTab(tab);
    setInstallFailed(false);
    setInstalledData(null);
    setLogs('');
    setDomain('');
    setEmail('');
    setAppName('');
    setGitUrl('');
    setPort('3000');
    setSiteTitle('My WordPress Site');
    setAdminUser('admin');
    setAdminPass(Math.random().toString(36).substring(2, 14));
    setDbMode('auto');
    setDbName('');
    setDbUser('');
    setDbPass('');
    setPmaPort(String(Math.floor(Math.random() * (9999 - 8000 + 1)) + 8000));
    setPmaUser('pma_admin');
    setPmaPassword(Math.random().toString(36).substring(2, 12));
    setShowPmaForm(false);
    setPhpVersion('8.2');
    setSsl(false);
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, 'success');
  };

  const handleInstall = async (e) => {
    e.preventDefault();
    if (!isConnected) {
      showToast('WebSocket chưa được kết nối. Vui lòng kết nối VPS trước.', 'error');
      return;
    }

    setLoading(true);
    setRunning(true);
    setInstallFailed(false);
    setInstalledData(null);
    setLogs(`>> [${new Date().toLocaleTimeString()}] Đang chuẩn bị kịch bản cài đặt cho ${activeTab.toUpperCase()}...\n`);

    try {
      const payload = { appId: activeTab };
      if (activeTab === 'wordpress') {
        payload.domain = domain.trim();
        payload.email = email.trim();
        payload.siteTitle = siteTitle.trim();
        payload.adminUser = adminUser.trim();
        payload.adminPass = adminPass.trim();
        payload.phpVersion = phpVersion;
        payload.ssl = ssl;
        if (dbMode === 'custom') {
          payload.dbName = dbName.trim();
          payload.dbUser = dbUser.trim();
          payload.dbPass = dbPass.trim();
        }
      } else if (activeTab === 'laravel') {
        payload.domain = domain.trim();
        payload.email = email.trim();
        payload.phpVersion = phpVersion;
        payload.ssl = ssl;
        if (dbMode === 'custom') {
          payload.dbName = dbName.trim();
          payload.dbUser = dbUser.trim();
          payload.dbPass = dbPass.trim();
        }
      } else if (activeTab === 'nodeapp') {
        payload.appName = appName.trim();
        payload.gitUrl = gitUrl.trim();
        payload.port = port.trim();
        if (domain.trim()) {
          payload.domain = domain.trim();
          payload.ssl = ssl;
          payload.email = email.trim();
        }
      } else if (activeTab === 'phpmyadmin') {
        payload.pmaPort = pmaPort.trim();
        payload.pmaUser = pmaUser.trim();
        payload.pmaPassword = pmaPassword.trim();
      }

      // Call the preparation API to get setup script
      const res = await apiCall('/api/installer/prepare', 'POST', payload);

      if (res.success) {
        preparedDataRef.current = res.data;
        setLogs(prev => prev + `>> Đã sinh cấu hình thành công. Bắt đầu gửi lệnh cài đặt thời gian thực...\n\n`);

        // Emit task to run
        socket.emit('task:run', {
          vpsConfig: currentVPS,
          command: res.command
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setLogs(prev => prev + `>> THẤT BẠI: ${errMsg}\n`);
      showToast('Không thể chuẩn bị cài đặt: ' + errMsg, 'error');
      setLoading(false);
      setRunning(false);
    }
  };

  const handleStopTask = () => {
    if (socket && running) {
      socket.emit('task:stop');
      setLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] TIẾN TRÌNH BỊ DỪNG bởi người dùng.\n`);
      setRunning(false);
      setLoading(false);
      showToast('Đã dừng tiến trình cài đặt', 'info');
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
            Triển khai nhanh mã nguồn WordPress, Laravel, phpMyAdmin, Portainer hoặc Node.js App trên VPS sử dụng luồng log thời gian thực qua WebSocket.
          </p>
        </div>
      </div>

      <div className="db-tabs-container">
        <button 
          onClick={() => handleTabChange('wordpress')}
          className={`db-tab-item ${activeTab === 'wordpress' ? 'active' : ''}`}
        >
          <span className="fab fa-wordpress text-lg mr-1.5" style={{ color: '#21759b' }}></span>
          WordPress
        </button>
        <button 
          onClick={() => handleTabChange('laravel')}
          className={`db-tab-item ${activeTab === 'laravel' ? 'active' : ''}`}
        >
          <span className="fab fa-laravel text-lg mr-1.5" style={{ color: '#ff2d20' }}></span>
          Laravel
        </button>
        <button 
          onClick={() => handleTabChange('phpmyadmin')}
          className={`db-tab-item ${activeTab === 'phpmyadmin' ? 'active' : ''}`}
        >
          <span className="fas fa-database text-lg mr-1.5" style={{ color: '#4f5b93' }}></span>
          phpMyAdmin
        </button>
        <button 
          onClick={() => handleTabChange('portainer')}
          className={`db-tab-item ${activeTab === 'portainer' ? 'active' : ''}`}
        >
          <span className="fab fa-docker text-lg mr-1.5" style={{ color: '#0db7ed' }}></span>
          Portainer CE
        </button>
        <button 
          onClick={() => handleTabChange('nodeapp')}
          className={`db-tab-item ${activeTab === 'nodeapp' ? 'active' : ''}`}
        >
          <span className="fab fa-node-js text-lg mr-1.5" style={{ color: '#68a063' }}></span>
          Node.js App
        </button>
      </div>

      <div className="grid gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Form panel */}
        <div className="space-y-6">
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              {activeTab === 'wordpress' && 'WordPress Auto-Installer'}
              {activeTab === 'laravel' && 'Laravel Auto-Installer'}
              {activeTab === 'phpmyadmin' && 'phpMyAdmin Deployer'}
              {activeTab === 'portainer' && 'Portainer Container Deployer'}
              {activeTab === 'nodeapp' && 'Node.js Git Deployer'}
            </h2>
            
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-2 text-xs text-gray-300">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <span>
                  {activeTab === 'wordpress' && 'Tự động thiết lập database ngẫu nhiên, Salts bảo mật, phân quyền thư mục và tạo cấu hình ảo hóa Nginx trên cổng 80.'}
                  {activeTab === 'laravel' && 'Tự động cài đặt cấu trúc mã nguồn Laravel, sinh file .env và DB ngẫu nhiên, cài composer packages và reload Nginx.'}
                  {activeTab === 'phpmyadmin' && 'Cài đặt và thiết lập phpMyAdmin phiên bản 5.2.1 trên cổng 8888 chạy độc lập qua Nginx để quản trị CSDL.'}
                  {activeTab === 'portainer' && 'Khởi chạy giao diện Docker Portainer GUI trên cổng 9000 (HTTP) và 9443 (HTTPS) để quản lý container trực quan.'}
                  {activeTab === 'nodeapp' && 'Tự động clone code từ Git Repo (Public), cài đặt production dependencies, tạo tài khoản pm2user và chạy nền qua PM2.'}
                </span>
              </div>
            </div>

            {activeTab === 'phpmyadmin' && pmaStatus.installed && !showPmaForm ? (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-xs text-gray-400">Trạng thái Public Access:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pmaStatus.enabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {pmaStatus.enabled ? 'ĐANG MỞ CỔNG' : 'ĐANG KHÓA CỔNG'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-xs text-gray-400">Cổng dịch vụ chạy:</span>
                    <span className="text-xs font-mono font-bold text-gray-200">{pmaStatus.port}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-xs text-gray-400">Bảo mật Basic Auth:</span>
                    <span className="text-xs font-bold text-yellow-400">BẮT BUỘC</span>
                  </div>

                  {pmaStatus.enabled && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-gray-400">Đường dẫn truy cập:</span>
                      <a 
                        href={`http://${currentVPS?.host}:${pmaStatus.port}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-indigo-400 font-semibold underline hover:text-indigo-300"
                      >
                        {`http://${currentVPS?.host}:${pmaStatus.port}`}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  {pmaStatus.enabled ? (
                    <button
                      type="button"
                      onClick={() => handleTogglePma('disable')}
                      disabled={loading}
                      className="btn btn-danger w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold rounded-lg"
                    >
                      <StopCircle size={14} />
                      Khóa truy cập phpMyAdmin (Tắt Site Nginx)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTogglePma('enable')}
                      disabled={loading}
                      className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold rounded-lg"
                    >
                      <Rocket size={14} />
                      Mở truy cập phpMyAdmin (Bật Site Nginx)
                    </button>
                  )}
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPmaForm(true)}
                    className="text-xs text-gray-400 hover:text-gray-200 underline transition-colors"
                  >
                    Thay đổi cấu hình / Cài đặt lại phpMyAdmin
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInstall} className="space-y-4">
                {(activeTab === 'wordpress' || activeTab === 'laravel') && (
                  <>
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
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                      <small className="text-[10px] text-gray-500 block leading-tight mt-1">Đảm bảo tên miền đã được trỏ cấu hình DNS (A Record) về IP của VPS này.</small>
                    </div>

                    <div className="grid gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="text-xs text-gray-400 block mb-1">Phiên bản PHP (PHP Version):</label>
                        <div className="flex items-center input-glass px-3 py-1">
                          <Server size={14} className="text-gray-500 mr-2" />
                          <select
                            value={phpVersion}
                            onChange={e => setPhpVersion(e.target.value)}
                            disabled={running}
                            className="bg-transparent border-none outline-none text-xs text-gray-100 w-full cursor-pointer py-1.5"
                            style={{ background: 'none', border: 'none', color: '#f3f4f6' }}
                          >
                            <option value="7.4">PHP 7.4</option>
                            <option value="8.0">PHP 8.0</option>
                            <option value="8.1">PHP 8.1</option>
                            <option value="8.2">PHP 8.2 (Khuyên dùng)</option>
                            <option value="8.3">PHP 8.3</option>
                            <option value="8.4">PHP 8.4</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="text-xs text-gray-400 block mb-1">Cấu hình SSL Let's Encrypt:</label>
                        <div className="flex items-center justify-between input-glass px-3" style={{ height: '34px' }}>
                          <span className="text-xs text-gray-300">Tự động kích hoạt HTTPS</span>
                          <label className="switch-container">
                            <input
                              type="checkbox"
                              checked={ssl}
                              onChange={e => setSsl(e.target.checked)}
                              disabled={running}
                            />
                            <span className="switch-slider"></span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {ssl && activeTab === 'laravel' && (
                      <div className="form-group animate-fade-in">
                        <label className="text-xs text-gray-400 block mb-1">Email đăng ký SSL (Let's Encrypt Email):</label>
                        <div className="flex items-center input-glass px-3 py-1">
                          <Mail size={14} className="text-gray-500 mr-2" />
                          <input
                            type="email"
                            required
                            placeholder="ví dụ: admin@mywebsite.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={running}
                            className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                            style={{ background: 'none', border: 'none', padding: '6px 0' }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'wordpress' && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tên trang web (Site Title):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Globe size={14} className="text-gray-500 mr-2" />
                        <input
                          type="text"
                          required
                          placeholder="ví dụ: My Awesome Blog"
                          value={siteTitle}
                          onChange={e => setSiteTitle(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Email quản trị viên (Admin Email):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Mail size={14} className="text-gray-500 mr-2" />
                        <input
                          type="email"
                          required
                          placeholder="ví dụ: admin@mywebsite.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="text-xs text-gray-400 block mb-1">Tài khoản quản trị (Admin User):</label>
                        <div className="flex items-center input-glass px-3 py-1">
                          <Layers size={14} className="text-gray-500 mr-2" />
                          <input
                            type="text"
                            required
                            placeholder="ví dụ: admin"
                            value={adminUser}
                            onChange={e => setAdminUser(e.target.value)}
                            disabled={running}
                            className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                            style={{ background: 'none', border: 'none', padding: '6px 0' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="text-xs text-gray-400 block mb-1">Mật khẩu admin (Admin Password):</label>
                        <div className="flex items-center input-glass px-3 py-1">
                          <Key size={14} className="text-gray-500 mr-2" />
                          <input
                            type="text"
                            required
                            placeholder="Mật khẩu Admin"
                            value={adminPass}
                            onChange={e => setAdminPass(e.target.value)}
                            disabled={running}
                            className="bg-transparent border-none outline-none text-xs text-gray-100 w-full font-mono"
                            style={{ background: 'none', border: 'none', padding: '6px 0' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Database options */}
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
                      <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-xs text-gray-300 font-semibold">Cấu hình Database:</span>
                        <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setDbMode('auto')}
                            className={`btn btn-xs ${dbMode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            disabled={running}
                          >
                            Tự động
                          </button>
                          <button
                            type="button"
                            onClick={() => setDbMode('custom')}
                            className={`btn btn-xs ${dbMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            disabled={running}
                          >
                            Tùy chọn
                          </button>
                        </div>
                      </div>

                      {dbMode === 'custom' && (
                        <div className="space-y-3 pt-1 animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="form-group">
                            <label className="text-[11px] text-gray-400 block mb-1">Tên Database (Database Name):</label>
                            <div className="flex items-center input-glass px-3 py-1">
                              <Database size={12} className="text-gray-500 mr-2" />
                              <input
                                type="text"
                                required
                                placeholder="ví dụ: custom_wp_db"
                                value={dbName}
                                onChange={e => setDbName(e.target.value)}
                                disabled={running}
                                className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                                style={{ background: 'none', border: 'none', padding: '4px 0' }}
                              />
                            </div>
                          </div>

                          <div className="grid gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="text-[11px] text-gray-400 block mb-1">Database User:</label>
                              <div className="flex items-center input-glass px-3 py-1">
                                <Layers size={12} className="text-gray-500 mr-2" />
                                <input
                                  type="text"
                                  required
                                  placeholder="ví dụ: custom_wp_user"
                                  value={dbUser}
                                  onChange={e => setDbUser(e.target.value)}
                                  disabled={running}
                                  className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                                  style={{ background: 'none', border: 'none', padding: '4px 0' }}
                                />
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="text-[11px] text-gray-400 block mb-1">Database Password:</label>
                              <div className="flex items-center input-glass px-3 py-1">
                                <Key size={12} className="text-gray-500 mr-2" />
                                <input
                                  type="text"
                                  required
                                  placeholder="Mật khẩu DB"
                                  value={dbPass}
                                  onChange={e => setDbPass(e.target.value)}
                                  disabled={running}
                                  className="bg-transparent border-none outline-none text-xs text-gray-100 w-full font-mono"
                                  style={{ background: 'none', border: 'none', padding: '4px 0' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'laravel' && (
                  <>
                    {/* Database options */}
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
                      <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-xs text-gray-300 font-semibold">Cấu hình Database:</span>
                        <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setDbMode('auto')}
                            className={`btn btn-xs ${dbMode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            disabled={running}
                          >
                            Tự động
                          </button>
                          <button
                            type="button"
                            onClick={() => setDbMode('custom')}
                            className={`btn btn-xs ${dbMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            disabled={running}
                          >
                            Tùy chọn
                          </button>
                        </div>
                      </div>

                      {dbMode === 'custom' && (
                        <div className="space-y-3 pt-1 animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="form-group">
                            <label className="text-[11px] text-gray-400 block mb-1">Tên Database (Database Name):</label>
                            <div className="flex items-center input-glass px-3 py-1">
                              <Database size={12} className="text-gray-500 mr-2" />
                              <input
                                type="text"
                                required
                                placeholder="ví dụ: custom_laravel_db"
                                value={dbName}
                                onChange={e => setDbName(e.target.value)}
                                disabled={running}
                                className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                                style={{ background: 'none', border: 'none', padding: '4px 0' }}
                              />
                            </div>
                          </div>

                          <div className="grid gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="text-[11px] text-gray-400 block mb-1">Database User:</label>
                              <div className="flex items-center input-glass px-3 py-1">
                                <Layers size={12} className="text-gray-500 mr-2" />
                                <input
                                  type="text"
                                  required
                                  placeholder="ví dụ: custom_laravel_user"
                                  value={dbUser}
                                  onChange={e => setDbUser(e.target.value)}
                                  disabled={running}
                                  className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                                  style={{ background: 'none', border: 'none', padding: '4px 0' }}
                                />
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="text-[11px] text-gray-400 block mb-1">Database Password:</label>
                              <div className="flex items-center input-glass px-3 py-1">
                                <Key size={12} className="text-gray-500 mr-2" />
                                <input
                                  type="text"
                                  required
                                  placeholder="Mật khẩu DB"
                                  value={dbPass}
                                  onChange={e => setDbPass(e.target.value)}
                                  disabled={running}
                                  className="bg-transparent border-none outline-none text-xs text-gray-100 w-full font-mono"
                                  style={{ background: 'none', border: 'none', padding: '4px 0' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'nodeapp' && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tên ứng dụng Node.js (App Name):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Layers size={14} className="text-gray-500 mr-2" />
                        <input
                          type="text"
                          required
                          placeholder="ví dụ: my-node-server"
                          value={appName}
                          onChange={e => setAppName(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Đường dẫn Git Repository (HTTPS Public URL):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Terminal size={14} className="text-gray-500 mr-2" />
                        <input
                          type="url"
                          required
                          placeholder="https://github.com/username/repo.git"
                          value={gitUrl}
                          onChange={e => setGitUrl(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Cổng dịch vụ chạy (Port):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Server size={14} className="text-gray-500 mr-2" />
                        <input
                          type="number"
                          required
                          placeholder="3000"
                          value={port}
                          onChange={e => setPort(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tên miền hoạt động (Tùy chọn - Nginx Proxy):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Globe size={14} className="text-gray-500 mr-2" />
                        <input
                          type="text"
                          placeholder="ví dụ: node.mywebsite.com (để trống nếu chạy qua cổng IP trực tiếp)"
                          value={domain}
                          onChange={e => setDomain(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                      <small className="text-[10px] text-gray-500 block leading-tight mt-1">
                        Nếu nhập tên miền, hệ thống sẽ tự động cấu hình Nginx Reverse Proxy trỏ đến cổng ứng dụng Node.js của bạn.
                      </small>
                    </div>

                    {domain.trim() && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
                            <Key size={14} className="text-indigo-400" />
                            Bảo mật SSL Let's Encrypt (HTTPS):
                          </span>
                          <label className="switch-container">
                            <input
                              type="checkbox"
                              checked={ssl}
                              onChange={e => setSsl(e.target.checked)}
                              disabled={running}
                            />
                            <span className="switch-slider"></span>
                          </label>
                        </div>
                        {ssl && (
                          <div className="form-group pt-1">
                            <label className="text-[11px] text-gray-400 block mb-1">Email đăng ký SSL (Let's Encrypt Email):</label>
                            <div className="flex items-center input-glass px-3 py-1">
                              <Mail size={12} className="text-gray-500 mr-2" />
                              <input
                                type="email"
                                required
                                placeholder="ví dụ: admin@domain.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={running}
                                className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                                style={{ background: 'none', border: 'none', padding: '4px 0' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'phpmyadmin' && (
                  <>
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Cổng truy cập phpMyAdmin (Port):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Server size={14} className="text-gray-500 mr-2" />
                        <input
                          type="number"
                          required
                          placeholder="VD: 8888"
                          value={pmaPort}
                          onChange={e => setPmaPort(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tài khoản bảo vệ Basic Auth (Username):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Layers size={14} className="text-gray-500 mr-2" />
                        <input
                          type="text"
                          required
                          placeholder="VD: pma_admin"
                          value={pmaUser}
                          onChange={e => setPmaUser(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Mật khẩu bảo vệ Basic Auth (Password):</label>
                      <div className="flex items-center input-glass px-3 py-1">
                        <Key size={14} className="text-gray-500 mr-2" />
                        <input
                          type="text"
                          required
                          placeholder="Nhập mật khẩu hoặc để tự động sinh"
                          value={pmaPassword}
                          onChange={e => setPmaPassword(e.target.value)}
                          disabled={running}
                          className="bg-transparent border-none outline-none text-xs text-gray-100 w-full font-mono"
                          style={{ background: 'none', border: 'none', padding: '6px 0' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'portainer' && (
                  <div className="p-3 bg-white/5 rounded-lg text-xs text-gray-400">
                    <p>Không cần cấu hình trước. Hệ thống sẽ tự kiểm tra docker và triển khai container Portainer CE.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {running ? (
                    <button
                      type="button"
                      onClick={handleStopTask}
                      className="btn btn-danger w-full py-2.5 flex items-center justify-center gap-2 font-semibold text-xs rounded-lg animate-pulse"
                    >
                      <StopCircle size={14} />
                      Dừng cài đặt
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading || ((activeTab === 'wordpress' || activeTab === 'laravel') && !domain.trim()) || (activeTab === 'nodeapp' && (!appName.trim() || !gitUrl.trim()))}
                      className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-semibold text-xs rounded-lg"
                    >
                      {loading ? (
                        <>
                          <Loader size={14} className="animate-spin" />
                          Đang chuẩn bị...
                        </>
                      ) : (
                        <>
                          <Rocket size={14} />
                          Cài đặt 1-Click ngay
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Success Credentials Display */}
          {installedData && (
            <div className="card-glass p-6 rounded-xl space-y-4 border border-green-500/20 bg-green-500/5 animate-fade-in">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={20} />
                <h3 className="font-bold text-sm">Cài đặt thành công! Thông tin kết nối:</h3>
              </div>

              <div className="space-y-2.5 text-xs">
                {(activeTab === 'wordpress' || activeTab === 'laravel') && (
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
                      <span className="text-green-300 flex items-center gap-1 font-bold">
                        {installedData.dbPass}
                        <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.dbPass, 'Database Password')} />
                      </span>
                    </div>
                  </div>
                )}

                {activeTab === 'wordpress' && (
                  <div className="p-3 bg-black/40 rounded-lg space-y-2 font-mono">
                    <div className="flex justify-between items-center border-b border-white/10 pb-1.5 mb-1.5">
                      <span className="text-yellow-400 font-semibold">Tài khoản quản trị WordPress:</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Admin Username:</span>
                      <span className="text-green-300 flex items-center gap-1">
                        {installedData.adminUser}
                        <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.adminUser, 'Admin Username')} />
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Admin Password:</span>
                      <span className="text-green-300 flex items-center gap-1 font-bold">
                        {installedData.adminPass}
                        <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.adminPass, 'Admin Password')} />
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Admin Email:</span>
                      <span className="text-green-300 flex items-center gap-1">
                        {installedData.adminEmail}
                        <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.adminEmail, 'Admin Email')} />
                      </span>
                    </div>
                  </div>
                )}

                {(activeTab === 'wordpress' || activeTab === 'laravel') && (
                  <div className="p-3 bg-white/5 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Đường dẫn Website:</span>
                      <a 
                        href={installedData.siteUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 font-semibold underline hover:text-indigo-300 text-xs"
                      >
                        {installedData.siteUrl}
                      </a>
                    </div>
                    {activeTab === 'wordpress' && (
                      <div className="flex justify-between items-center border-t border-white/5 pt-1.5">
                        <span className="text-gray-400">Đường dẫn Quản trị (wp-admin):</span>
                        <a 
                          href={`${installedData.siteUrl}/wp-admin`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-indigo-400 font-semibold underline hover:text-indigo-300 text-xs"
                        >
                          {`${installedData.siteUrl}/wp-admin`}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'phpmyadmin' && (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Đường dẫn phpMyAdmin:</span>
                      <a 
                        href={installedData.siteUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-400 font-semibold underline hover:text-indigo-300"
                      >
                        {installedData.siteUrl}
                      </a>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg space-y-2 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Basic Auth User:</span>
                        <span className="text-green-300 flex items-center gap-1">
                          {installedData.pmaUser}
                          <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.pmaUser, 'Basic Auth User')} />
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Basic Auth Password:</span>
                        <span className="text-green-300 flex items-center gap-1 font-bold">
                          {installedData.pmaPassword}
                          <Copy size={12} className="cursor-pointer text-gray-500 hover:text-white" onClick={() => handleCopy(installedData.pmaPassword, 'Basic Auth Password')} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'portainer' && (
                  <div className="p-3 bg-black/40 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">HTTP Port:</span>
                      <a href={installedData.siteUrl} target="_blank" rel="noreferrer" className="text-indigo-400 font-semibold underline hover:text-indigo-300">
                        {installedData.siteUrl}
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">HTTPS Port (Bảo mật):</span>
                      <a href={installedData.secureUrl} target="_blank" rel="noreferrer" className="text-indigo-400 font-semibold underline hover:text-indigo-300">
                        {installedData.secureUrl}
                      </a>
                    </div>
                  </div>
                )}

                {activeTab === 'nodeapp' && (
                  <div className="p-3 bg-black/40 rounded-lg space-y-2">
                    <div className="flex justify-between items-center font-mono">
                      <span className="text-gray-400">Tên ứng dụng:</span>
                      <span className="text-green-300">{installedData.appName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Đường dẫn hoạt động:</span>
                      <a href={installedData.appUrl} target="_blank" rel="noreferrer" className="text-indigo-400 font-semibold underline hover:text-indigo-300">
                        {installedData.appUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Logs Terminal view */}
        <div className="card-glass p-5 rounded-xl flex flex-col h-[480px]">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
            <Terminal size={16} />
            Tiến trình cài đặt thời gian thực (Live WebSocket logs)
          </h3>

          <pre 
            ref={logEndRef}
            className="flex-1 bg-black/60 text-green-400 p-4 font-mono text-xs overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/5"
            style={{ maxHeight: '350px' }}
          >
            {logs || '>> Sẵn sàng. Nhập thông tin cấu hình và nhấn nút cài đặt...'}
          </pre>

          {installFailed && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-red-400">Cài đặt thất bại!</h4>
                  <p className="text-[11px] text-gray-400">
                    Đã xảy ra sự cố trong quá trình cài đặt. Bạn có thể sao chép báo cáo lỗi hoặc tải file log để gửi cho bộ phận kỹ thuật hỗ trợ khắc phục.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCopyErrorReport}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={13} />
                  Sao chép báo cáo lỗi
                </button>
                <button
                  onClick={handleDownloadLog}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                >
                  <Terminal size={13} />
                  Tải file Log lỗi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
