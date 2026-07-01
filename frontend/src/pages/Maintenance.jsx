import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { ShieldCheck, RefreshCw, Cpu, Check, Download, ShieldAlert, Globe, Mail, Lock } from 'lucide-react';

export default function Maintenance() {
  const { apiCall, showToast, currentVPS } = useVPS();
  const [osDetails, setOsDetails] = useState({ osType: 'unknown', packageManager: 'apt' });
  const [installedSoftware, setInstalledSoftware] = useState({});
  const [loading, setLoading] = useState(false);
  const [installingKey, setInstallingKey] = useState(null);

  // Custom package input
  const [customPackage, setCustomPackage] = useState('');

  // Panel Domain & SSL Configuration
  const [panelDomain, setPanelDomain] = useState('');
  const [panelEmail, setPanelEmail] = useState('');
  const [configuringSSL, setConfiguringSSL] = useState(false);

  // Panel Update Check
  const [updateStatus, setUpdateStatus] = useState({ checked: false, hasUpdate: false, currentVersion: '', latestVersion: '', changelog: [] });
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Categories & UI Filtering
  const [activeCategory, setActiveCategory] = useState('all');

  const softwareList = [
    // Web Servers & Stacks
    { key: 'lemp', name: 'LEMP Stack (Nginx, MySQL, PHP)', desc: 'Bộ khung chạy web PHP hoàn chỉnh', installEndpoint: '/api/software/install-lemp', category: 'web' },
    { key: 'nginx', name: 'Nginx Web Server', desc: 'Máy chủ Web và Reverse Proxy nhẹ, hiệu năng cao', installEndpoint: '/api/software/install-nginx', category: 'web' },
    { key: 'apache', name: 'Apache Web Server', desc: 'Máy chủ Web HTTP truyền thống và ổn định', installEndpoint: '/api/software/install-apache', category: 'web' },
    { key: 'certbot', name: 'Certbot SSL (Let\'s Encrypt)', desc: 'Tự động tạo và gia hạn chứng chỉ SSL miễn phí', installEndpoint: '/api/software/install-certbot', category: 'web' },
    { key: 'phpmyadmin', name: 'phpMyAdmin', desc: 'Giao diện quản lý CSDL MySQL/MariaDB qua trình duyệt', installEndpoint: '/api/software/install-phpmyadmin', category: 'web' },

    // Databases
    { key: 'mysql', name: 'MySQL Database Server', desc: 'Cơ sở dữ liệu quan hệ SQL mạnh mẽ', installEndpoint: '/api/software/install-mysql', category: 'db' },
    { key: 'redis', name: 'Redis Server', desc: 'Cơ sở dữ liệu lưu trữ in-memory cache tốc độ cao', installEndpoint: '/api/software/install-redis', category: 'db' },
    { key: 'mongodb', name: 'MongoDB Server', desc: 'Cơ sở dữ liệu NoSQL dạng văn bản JSON', installEndpoint: '/api/software/install-mongodb', category: 'db' },
    { key: 'postgresql', name: 'PostgreSQL Server', desc: 'Hệ quản trị cơ sở dữ liệu quan hệ mạnh mẽ', installEndpoint: '/api/software/install-postgresql', category: 'db' },
    { key: 'memcached', name: 'Memcached Server', desc: 'Hệ thống cache bộ nhớ đệm đối tượng hiệu năng cao', installEndpoint: '/api/software/install-memcached', category: 'db' },

    // Runtimes & Compilers
    { key: 'php', name: 'PHP-FPM Engine', desc: 'Bộ xử lý script PHP FastCGI chạy web PHP', installEndpoint: '/api/software/install-php', category: 'runtime' },
    { key: 'nodejs', name: 'Node.js Engine', desc: 'Môi trường thực thi Javascript phía máy chủ', installEndpoint: '/api/software/install-nodejs', category: 'runtime', hasVersion: true },
    { key: 'java', name: 'Java OpenJDK 17', desc: 'Môi trường phát triển & chạy Java (Minecraft, Web Apps...)', installEndpoint: '/api/software/install-java', category: 'runtime' },
    { key: 'python', name: 'Python 3', desc: 'Môi trường chạy các ứng dụng script Python & pip', installEndpoint: '/api/software/install-python', category: 'runtime' },
    { key: 'golang', name: 'Golang compiler', desc: 'Môi trường chạy và biên dịch ngôn ngữ Go', installEndpoint: '/api/software/install-golang', category: 'runtime' },
    { key: 'composer', name: 'Composer PHP', desc: 'Bộ quản lý thư viện dependency cho PHP', installEndpoint: '/api/software/install-composer', category: 'runtime' },

    // Utilities & Security
    { key: 'docker', name: 'Docker Engine', desc: 'Trình quản lý container mã nguồn mở', installEndpoint: '/api/software/install-docker', category: 'utility' },
    { key: 'portainer', name: 'Portainer CE', desc: 'Giao diện Web UI quản lý Docker Container trực quan', installEndpoint: '/api/software/install-portainer', category: 'utility' },
    { key: 'fail2ban', name: 'Fail2ban Defender', desc: 'Ngăn chặn tấn công brute-force SSH & quét cổng', installEndpoint: '/api/software/install-fail2ban', category: 'utility' },
    { key: 'pm2', name: 'PM2 Process Manager', desc: 'Quản lý tiến trình ứng dụng NodeJS chạy ngầm', installEndpoint: '/api/software/install-pm2', category: 'utility' },
    { key: 'git', name: 'Git Version Control', desc: 'Hệ thống quản lý phiên bản mã nguồn', installEndpoint: '/api/software/install-git', category: 'utility' },
    { key: 'rsync', name: 'Rsync File Sync', desc: 'Đồng bộ và sao chép tệp tin tốc độ cao, an toàn', installEndpoint: '/api/software/install-rsync', category: 'utility' },
    { key: 'ufw', name: 'UFW Firewall', desc: 'Công cụ tường lửa đơn giản bảo vệ cổng kết nối VPS', installEndpoint: '/api/software/install-ufw', category: 'utility' },
    { key: 'supervisor', name: 'Supervisor Manager', desc: 'Quản lý và giám sát các tiến trình chạy ngầm', installEndpoint: '/api/software/install-supervisor', category: 'utility' },
    { key: 'rclone', name: 'Rclone Sync', desc: 'Đồng bộ dữ liệu VPS lên Google Drive, OneDrive,...', installEndpoint: '/api/software/install-rclone', category: 'utility' },
    { key: 'netdata', name: 'Netdata Monitor', desc: 'Giám sát hệ thống thời gian thực qua giao diện web trực quan', installEndpoint: '/api/software/install-netdata', category: 'utility' },
    { key: 'vsftpd', name: 'vsftpd FTP Server', desc: 'Dịch vụ truyền tải tệp tin FTP nhanh và bảo mật', installEndpoint: '/api/software/install-vsftpd', category: 'utility' },
    { key: 'postfix', name: 'Postfix Mail Transfer', desc: 'Dịch vụ gửi nhận thư điện tử SMTP cơ bản', installEndpoint: '/api/software/install-postfix', category: 'utility' }
  ];

  useEffect(() => {
    fetchSystemDetails();
    checkUpdateStatus();
  }, []);

  const checkUpdateStatus = async () => {
    setCheckingUpdate(true);
    try {
      const res = await apiCall('/api/system/update-status', 'POST');
      if (res.success) {
        setUpdateStatus({
          checked: true,
          hasUpdate: res.hasUpdate,
          currentVersion: res.currentVersion,
          latestVersion: res.latestVersion || '',
          changelog: res.changelog || []
        });
      } else {
        setUpdateStatus(prev => ({ ...prev, checked: true, error: res.error }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const fetchSystemDetails = async () => {
    setLoading(true);
    try {
      const osRes = await apiCall('/api/software/detect-os', 'POST');
      setOsDetails(osRes.data || { osType: 'unknown', packageManager: 'apt' });

      const softRes = await apiCall('/api/software/installed', 'POST');
      setInstalledSoftware(softRes.data?.installed || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOS = async () => {
    if (!window.confirm('Cập nhật hệ thống (update & upgrade) có thể mất vài phút. Bạn có chắc chắn muốn chạy?')) return;
    setInstallingKey('os-update');
    try {
      showToast('Đang thực hiện cập nhật toàn bộ thư viện hệ thống...', 'info');
      await apiCall('/api/software/update', 'POST');
      showToast('Cập nhật hệ thống thành công!', 'success');
      fetchSystemDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setInstallingKey(null);
    }
  };

  const handleUpdatePanel = async () => {
    if (!window.confirm('Cập nhật Panel sẽ tải mã nguồn mới nhất từ Git, cài đặt thư viện và khởi động lại ứng dụng qua PM2.\n\nQuá trình này sẽ tạm ngắt kết nối Panel trong vài giây. Bạn có chắc chắn muốn cập nhật?')) return;
    setInstallingKey('panel-update');
    try {
      showToast('Bắt đầu tải bản cập nhật mới nhất cho Panel...', 'info');
      const res = await apiCall('/api/system/update-panel', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
        // Đợi 6 giây rồi reload lại trang
        setTimeout(() => {
          window.location.reload();
        }, 6000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstallingKey(null);
    }
  };

  const handleInstallSoftware = async (software) => {
    setInstallingKey(software.key);
    try {
      showToast(`Đang tải và cài đặt ${software.name}...`, 'info');
      await apiCall(software.installEndpoint, 'POST');
      showToast(`Đã cài đặt ${software.name} thành công!`, 'success');
      fetchSystemDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setInstallingKey(null);
    }
  };

  const handleInstallCustomPackage = async (e) => {
    e.preventDefault();
    if (!customPackage.trim()) return;
    setInstallingKey('custom-package');
    try {
      showToast(`Đang cài đặt gói tin ${customPackage} qua ${osDetails.packageManager}...`, 'info');
      await apiCall('/api/software/install', 'POST', { packages: [customPackage.trim()] });
      showToast(`Đã cài đặt gói ${customPackage} thành công!`, 'success');
      setCustomPackage('');
      fetchSystemDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setInstallingKey(null);
    }
  };

  const handleConfigurePanelSSL = async (e) => {
    e.preventDefault();
    if (!panelDomain.trim()) {
      showToast('Vui lòng nhập tên miền', 'warning');
      return;
    }
    const isLocalhostDomain = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if ((currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1') && isLocalhostDomain) {
      showToast('Không thể cài đặt SSL Let\'s Encrypt ở chế độ Native Mode (Localhost).', 'warning');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn cấu hình tên miền ${panelDomain} và cài đặt SSL Let's Encrypt cho Panel không? Hãy đảm bảo tên miền đã được trỏ DNS về IP của VPS.`)) return;

    setConfiguringSSL(true);
    showToast(`Đang cấu hình tên miền ${panelDomain} và cài đặt Let's Encrypt SSL...`, 'info');
    try {
      const res = await apiCall('/api/system/setup-panel-ssl', 'POST', {
        domain: panelDomain.trim(),
        email: panelEmail.trim()
      });
      if (res.success) {
        showToast(res.message, 'success');
        setPanelDomain('');
        setPanelEmail('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfiguringSSL(false);
    }
  };

  const getCleanVersion = (rawVersion) => {
    if (!rawVersion) return '';
    const match = rawVersion.match(/(\d+\.\d+(\.\d+)?)/);
    return match ? match[1] : rawVersion.substring(0, 15);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Bảo trì & Cài đặt Phần mềm</h1>
          <p className="text-sm text-gray-400">Kiểm tra phiên bản hệ điều hành, cài đặt ứng dụng một chạm hoặc nâng cấp hệ thống</p>
        </div>
        <button
          onClick={fetchSystemDetails}
          disabled={loading || installingKey !== null}
          className="btn btn-glass flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      <div className="db-layout-container">
        {/* System Info */}
        <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Cpu size={18} className="text-indigo-400" />
            Hệ điều hành VPS
          </h2>
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between border-b border-white/5 pb-2" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
              <span className="text-gray-400">Hệ điều hành:</span>
              <span className="text-gray-200 capitalize" style={{ fontWeight: 600 }}>{osDetails.osType}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
              <span className="text-gray-400">Trình quản lý gói:</span>
              <span className="text-gray-200 uppercase" style={{ fontWeight: 600 }}>{osDetails.packageManager}</span>
            </div>
          </div>
          
          <div className="pt-3">
            <button
              onClick={handleUpdateOS}
              disabled={installingKey !== null}
              className="btn btn-glass btn-block text-indigo-300"
              style={{ padding: '10px' }}
            >
              <RefreshCw size={14} className={installingKey === 'os-update' ? 'animate-spin' : ''} />
              {installingKey === 'os-update' ? 'Đang cập nhật...' : 'Cập nhật hệ thống'}
            </button>
          </div>
          
          <div className="pt-3 border-t border-white/5 mt-3 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">VPS Manager Panel:</span>
              <button 
                onClick={checkUpdateStatus} 
                disabled={checkingUpdate || installingKey !== null}
                className="hover:text-indigo-400 text-gray-500 transition-colors flex items-center gap-1.5"
                title="Kiểm tra cập nhật"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <RefreshCw size={12} className={checkingUpdate ? 'animate-spin' : ''} />
                {checkingUpdate ? 'Đang check...' : 'Kiểm tra'}
              </button>
            </div>
            
            {updateStatus.checked && (
              <div className="text-[11px] font-mono leading-relaxed bg-white/5 p-2.5 rounded-lg border border-white/5 space-y-1">
                <div>
                  <span className="text-gray-400">Hiện tại:</span>{' '}
                  <span className="text-gray-200">{updateStatus.currentVersion || 'Không rõ'}</span>
                </div>
                {updateStatus.hasUpdate && updateStatus.latestVersion && (
                  <div>
                    <span className="text-yellow-400">Mới nhất:</span>{' '}
                    <span className="text-yellow-300 font-semibold">{updateStatus.latestVersion}</span>
                  </div>
                )}
                <div className="pt-1">
                  {updateStatus.hasUpdate ? (
                    <span className="text-yellow-400 font-bold block">● Có bản cập nhật mới!</span>
                  ) : (
                    <span className="text-green-400 block">✓ Đang chạy bản mới nhất</span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleUpdatePanel}
              disabled={!updateStatus.hasUpdate || installingKey !== null || checkingUpdate}
              className={`btn btn-block text-xs py-2.5 flex items-center justify-center gap-2 ${
                updateStatus.hasUpdate 
                  ? 'btn-primary text-white font-semibold' 
                  : 'btn-secondary text-gray-500 cursor-not-allowed'
              }`}
              style={{ padding: '10px' }}
            >
              <RefreshCw size={14} className={installingKey === 'panel-update' ? 'animate-spin' : ''} />
              {installingKey === 'panel-update' 
                ? 'Đang cập nhật...' 
                : updateStatus.hasUpdate 
                  ? 'Cập nhật Panel ngay' 
                  : 'Đã là bản mới nhất'}
            </button>

            {updateStatus.hasUpdate && updateStatus.changelog.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <span className="text-[11px] font-semibold text-yellow-400 block">Nội dung cập nhật mới:</span>
                <div className="max-h-28 overflow-y-auto text-[10px] font-mono text-gray-400 bg-black/20 p-2 rounded-lg border border-white/5 space-y-1 leading-normal pr-1">
                  {updateStatus.changelog.map((commit, idx) => (
                    <div key={idx} className="border-b border-white/5 pb-1 last:border-0 last:pb-0">
                      {commit}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Package Installer & SSL Panel Configuration */}
        <div className="db-layout-main">
          {/* Card 1: Custom Package Installer */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Download size={18} className="text-green-400" />
              Cài đặt gói tự do (Apt / Yum)
            </h2>
            <p className="text-sm text-gray-400">
              Nếu cần cài các gói lệnh Linux cụ thể, bạn có thể gõ nhanh tên gói vào đây thay vì mở Terminal.
            </p>
            <form onSubmit={handleInstallCustomPackage} style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
              <input
                type="text"
                required
                disabled={installingKey !== null}
                placeholder="VD: curl, unzip, zip, htop, fail2ban"
                value={customPackage}
                onChange={(e) => setCustomPackage(e.target.value)}
                className="input-glass"
                style={{ padding: '10px 14px' }}
              />
              <button
                type="submit"
                disabled={installingKey !== null}
                className="btn btn-primary"
                style={{ padding: '10px 20px' }}
              >
                Cài đặt
              </button>
            </form>
          </div>

          {/* Card 2: Panel Domain & SSL Configuration */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe size={18} className="text-indigo-400" />
              Thiết lập Tên miền & SSL truy cập Panel
            </h2>
            <p className="text-sm text-gray-400">
              Cấu hình tên miền riêng và chứng chỉ SSL Let's Encrypt giúp bạn truy cập VPS Manager Panel an toàn qua HTTPS thay vì liên kết HTTP mặc định.
            </p>

            {(currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (
              <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-300 leading-relaxed flex items-center gap-2.5">
                <ShieldAlert className="text-yellow-400 shrink-0" size={20} />
                <div>
                  <strong>Cảnh báo Native Mode (Localhost)</strong>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Cài đặt SSL Let's Encrypt yêu cầu VPS có IP Public công khai và một tên miền được trỏ DNS A về IP đó. Chế độ Native Mode (Localhost) không hỗ trợ tính năng này.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-300 leading-relaxed flex items-center gap-2.5">
                <Globe className="text-indigo-400 shrink-0" size={20} />
                <div>
                  <strong>Yêu cầu DNS cấu hình trước:</strong>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    Bạn phải cấu hình bản ghi A cho tên miền của bạn (ví dụ: <code>panel.cua-ban.com</code>) trỏ về IP của VPS này (<code>{currentVPS?.host}</code>) trước khi thực hiện cài đặt.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleConfigurePanelSSL} className="space-y-4 pt-2">
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Globe size={14} className="text-gray-500" />
                  Tên miền truy cập (Domain)
                </label>
                <input
                  type="text"
                  required
                  disabled={configuringSSL || currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1'}
                  placeholder="VD: panel.domain.com"
                  value={panelDomain}
                  onChange={(e) => setPanelDomain(e.target.value)}
                  className="input-glass"
                  style={{ padding: '10px 14px', width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-500" />
                  Email đăng ký SSL (Let's Encrypt)
                </label>
                <input
                  type="email"
                  required
                  disabled={configuringSSL || currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1'}
                  placeholder="VD: admin@domain.com"
                  value={panelEmail}
                  onChange={(e) => setPanelEmail(e.target.value)}
                  className="input-glass"
                  style={{ padding: '10px 14px', width: '100%' }}
                />
              </div>

              <button
                type="submit"
                disabled={configuringSSL || currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1'}
                className="btn btn-primary flex items-center justify-center gap-2"
                style={{ padding: '10px 20px', width: '100%', marginTop: '8px' }}
              >
                {configuringSSL ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Đang thiết lập Tên miền & SSL...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Cấu hình Tên miền & SSL
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* One click software installers */}
      <div className="card-glass p-6 rounded-xl space-y-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-400" />
            Cài đặt ứng dụng & Dịch vụ 1-click
          </h2>
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'web', label: 'Web & Stacks' },
              { id: 'db', label: 'Cơ sở dữ liệu' },
              { id: 'runtime', label: 'Môi trường chạy' },
              { id: 'utility', label: 'Hệ thống & Tiện ích' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`btn btn-xs ${activeCategory === tab.id ? 'btn-primary' : 'btn-glass'}`}
                style={{ padding: '6px 12px', fontSize: '11px', border: 'none' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-gray-400">Đang quét phần mềm đã cài đặt trên VPS...</div>
        ) : (
          <div className="service-grid">
            {softwareList
              .filter(soft => activeCategory === 'all' || soft.category === activeCategory)
              .map((soft) => {
                const nameMap = {
                  lemp: 'nginx',
                  python: 'python3',
                  mongodb: 'mongod',
                  postgresql: 'psql',
                  apache: 'apache2',
                  golang: 'go',
                  fail2ban: 'fail2ban-client'
                };
                const systemKey = nameMap[soft.key] || soft.key;
                const status = installedSoftware[systemKey];
                const isInstalled = status?.installed;
                const version = getCleanVersion(status?.version);

                const catColors = {
                  web: '#a855f7',
                  db: '#06b6d4',
                  runtime: '#f97316',
                  utility: '#f43f5e'
                };
                const catNames = {
                  web: 'Web Server',
                  db: 'Database',
                  runtime: 'Runtime',
                  utility: 'Hệ thống'
                };

                return (
                  <div key={soft.key} className="service-card p-5" style={{ display: 'flex', flexDirection: 'column', borderLeft: `3px solid ${catColors[soft.category] || 'rgba(255,255,255,0.1)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${catColors[soft.category]}15`, color: catColors[soft.category], border: `1px solid ${catColors[soft.category]}25` }}>
                        {catNames[soft.category]}
                      </span>
                      {isInstalled ? (
                        <span className="status-badge success text-[10px]">
                          Active
                        </span>
                      ) : (
                        <span className="status-badge text-[10px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                          Chưa cài
                        </span>
                      )}
                    </div>
                    
                    <div className="service-header mb-1">
                      <span className="font-semibold text-gray-200 font-outfit" style={{ fontSize: '14px' }}>{soft.name}</span>
                    </div>
                    <p className="service-info text-[11px] text-gray-400 leading-relaxed mb-3 flex-1">{soft.desc}</p>
                    
                    {isInstalled && version && (
                      <span className="text-[10px] block font-mono text-indigo-400 mb-3">Phiên bản: {version}</span>
                    )}

                    <div className="mt-auto" style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleInstallSoftware(soft)}
                        disabled={isInstalled || installingKey !== null}
                        className={`btn btn-block ${isInstalled ? 'btn-secondary text-gray-500 cursor-not-allowed' : 'btn-primary'}`}
                        style={{ padding: '6px', fontSize: '11px', flex: 1 }}
                      >
                        {installingKey === soft.key ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Cài đặt...
                          </>
                        ) : isInstalled ? (
                          'Đã sẵn sàng'
                        ) : (
                          'Cài đặt'
                        )}
                      </button>
                      {isInstalled && (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Bạn có chắc chắn muốn gỡ cài đặt hoàn toàn ${soft.name}? Thao tác này có thể làm mất dữ liệu.`)) return;
                            setInstallingKey(soft.key);
                            try {
                              showToast(`Đang gỡ cài đặt ${soft.name}...`, 'info');
                              const res = await apiCall('/api/software/uninstall', 'POST', { softwareId: soft.key });
                              if (res.success) {
                                showToast(res.message, 'success');
                                fetchSystemDetails();
                              }
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setInstallingKey(null);
                            }
                          }}
                          disabled={installingKey !== null}
                          className="btn btn-danger text-xs"
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        >
                          Gỡ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
