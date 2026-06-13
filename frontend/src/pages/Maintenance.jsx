import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { ShieldCheck, RefreshCw, Cpu, Check, Download } from 'lucide-react';

export default function Maintenance() {
  const { apiCall, showToast } = useVPS();
  const [osDetails, setOsDetails] = useState({ osType: 'unknown', packageManager: 'apt' });
  const [installedSoftware, setInstalledSoftware] = useState({});
  const [loading, setLoading] = useState(false);
  const [installingKey, setInstallingKey] = useState(null);

  // Custom package input
  const [customPackage, setCustomPackage] = useState('');

  const softwareList = [
    { key: 'lemp', name: 'LEMP Stack (Nginx, MySQL, PHP)', desc: 'Bộ khung chạy web PHP hoàn chỉnh', installEndpoint: '/api/software/install-lemp' },
    { key: 'nginx', name: 'Nginx Web Server', desc: 'Máy chủ Web và Reverse Proxy nhẹ, hiệu năng cao', installEndpoint: '/api/software/install-nginx' },
    { key: 'mysql', name: 'MySQL Database Server', desc: 'Cơ sở dữ liệu quan hệ SQL mạnh mẽ', installEndpoint: '/api/software/install-mysql' },
    { key: 'php', name: 'PHP-FPM Engine', desc: 'Bộ xử lý script PHP FastCGI chạy web', installEndpoint: '/api/software/install-php' },
    { key: 'apache', name: 'Apache Web Server', desc: 'Máy chủ Web HTTP truyền thống và ổn định', installEndpoint: '/api/software/install-apache' },
    { key: 'nodejs', name: 'Node.js Engine', desc: 'Môi trường thực thi Javascript phía máy chủ', installEndpoint: '/api/software/install-nodejs', hasVersion: true },
    { key: 'docker', name: 'Docker Engine', desc: 'Trình quản lý container mã nguồn mở', installEndpoint: '/api/software/install-docker' },
    { key: 'java', name: 'Java OpenJDK 17', desc: 'Môi trường phát triển & chạy Java (Minecraft Server...)', installEndpoint: '/api/software/install-java' },
    { key: 'python', name: 'Python 3', desc: 'Môi trường chạy các ứng dụng script Python & pip', installEndpoint: '/api/software/install-python' },
    { key: 'redis', name: 'Redis Server', desc: 'Cơ sở dữ liệu lưu trữ in-memory cache tốc độ cao', installEndpoint: '/api/software/install-redis' },
    { key: 'mongodb', name: 'MongoDB Server', desc: 'Cơ sở dữ liệu NoSQL dạng văn bản JSON', installEndpoint: '/api/software/install-mongodb' },
    { key: 'postgresql', name: 'PostgreSQL Server', desc: 'Hệ quản trị cơ sở dữ liệu quan hệ mạnh mẽ', installEndpoint: '/api/software/install-postgresql' },
    { key: 'golang', name: 'Golang compiler', desc: 'Môi trường chạy và biên dịch Go', installEndpoint: '/api/software/install-golang' },
    { key: 'fail2ban', name: 'Fail2ban Defender', desc: 'Ngăn chặn tấn công brute-force SSH & quét cổng', installEndpoint: '/api/software/install-fail2ban' },
    { key: 'pm2', name: 'PM2 Process Manager', desc: 'Quản lý tiến trình ứng dụng NodeJS', installEndpoint: '/api/software/install-pm2' },
    { key: 'git', name: 'Git Version Control', desc: 'Hệ thống quản lý phiên bản mã nguồn', installEndpoint: '/api/software/install-git' },
    { key: 'certbot', name: 'Certbot SSL (Let\'s Encrypt)', desc: 'Tự động tạo và gia hạn chứng chỉ SSL miễn phí', installEndpoint: '/api/software/install-certbot' },
    { key: 'composer', name: 'Composer PHP', desc: 'Bộ quản lý thư viện dependency cho PHP', installEndpoint: '/api/software/install-composer' }
  ];

  useEffect(() => {
    fetchSystemDetails();
  }, []);

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
        </div>

        {/* Custom Package Installer */}
        <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
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
      </div>

      {/* One click software installers */}
      <div className="card-glass p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck size={18} className="text-indigo-400" />
          Cài đặt ứng dụng 1-click
        </h2>
        
        {loading ? (
          <div className="text-center py-8 text-gray-400">Đang quét phần mềm đã cài đặt trên VPS...</div>
        ) : (
          <div className="service-grid">
            {softwareList.map((soft) => {
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

              return (
                <div key={soft.key} className="service-card p-5">
                  {isInstalled && (
                    <span className="absolute top-4 right-4 status-badge success">
                      Installed
                    </span>
                  )}
                  {!isInstalled && (
                    <span className="absolute top-4 right-4 status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                      Chưa có
                    </span>
                  )}
                  
                  <div className="service-header mb-2">
                    <span className="font-semibold text-gray-200 font-outfit" style={{ fontSize: '15px' }}>{soft.name}</span>
                  </div>
                  <p className="service-info text-xs text-gray-400 leading-relaxed mb-4 flex-1">{soft.desc}</p>
                  
                  {isInstalled && version && (
                    <span className="text-[10px] block font-mono text-indigo-400 mb-3">Phiên bản: {version}</span>
                  )}

                  <div className="mt-auto">
                    <button
                      onClick={() => handleInstallSoftware(soft)}
                      disabled={isInstalled || installingKey !== null}
                      className={`btn btn-block ${isInstalled ? 'btn-secondary text-gray-500 cursor-not-allowed' : 'btn-primary'}`}
                      style={{ padding: '6px' }}
                    >
                      {installingKey === soft.key ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Đang cài đặt...
                        </>
                      ) : isInstalled ? (
                        'Đã sẵn sàng'
                      ) : (
                        'Cài đặt ngay'
                      )}
                    </button>
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
