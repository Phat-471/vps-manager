import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { RotateCw, ShieldCheck, Terminal, Play, Square, Cpu, HardDrive } from 'lucide-react';

const SOFTWARE_LIST = [
  { id: 'lemp', name: 'LEMP Stack', icon: 'fa-solid fa-leaf', color: '#22c55e', desc: 'Nginx, MySQL, PHP-FPM. Cấu hình hoàn hảo cho WordPress, Laravel.' },
  { id: 'nginx', name: 'Nginx Web Server', icon: 'fa-solid fa-server', color: '#009639', desc: 'Máy chủ web hiệu năng cao, nhẹ và xử lý reverse proxy mạnh mẽ.' },
  { id: 'mysql', name: 'MySQL Server', icon: 'fa-solid fa-database', color: '#00758f', desc: 'Hệ quản trị cơ sở dữ liệu quan hệ SQL phổ biến nhất thế giới.' },
  { id: 'php', name: 'PHP-FPM Engine', icon: 'fa-brands fa-php', color: '#777bb4', desc: 'Trình biên dịch PHP FastCGI xử lý các ứng dụng web PHP.' },
  { id: 'apache', name: 'Apache Server', icon: 'fa-solid fa-feather', color: '#d11623', desc: 'Máy chủ web Apache HTTP truyền thống, ổn định và tùy biến cao.' },
  { id: 'nodejs', name: 'Node.js', icon: 'fa-brands fa-node-js', color: '#68a063', desc: 'Môi trường thực thi JavaScript phía server. Bao gồm NPM và PM2.' },
  { id: 'docker', name: 'Docker', icon: 'fa-brands fa-docker', color: '#2496ed', desc: 'Cài đặt Docker Engine và Docker Compose để chạy container.' },
  { id: 'java', name: 'Java OpenJDK 17', icon: 'fa-brands fa-java', color: '#e76f00', desc: 'Môi trường chạy Java để triển khai game server (Minecraft) hoặc web apps.' },
  { id: 'mongodb', name: 'MongoDB', icon: 'fa-solid fa-database', color: '#47a248', desc: 'Cơ sở dữ liệu NoSQL phổ biến nhất cho ứng dụng hiện đại.' },
  { id: 'redis', name: 'Redis', icon: 'fa-solid fa-bolt', color: '#dc382d', desc: 'In-memory data structure store, dùng làm database, cache, message broker.' },
  { id: 'golang', name: 'Golang compiler', icon: 'fa-solid fa-code', color: '#00add8', desc: 'Trình biên dịch ngôn ngữ Go để xây dựng ứng dụng tốc độ cao.' },
  { id: 'fail2ban', name: 'Fail2Ban Security', icon: 'fa-solid fa-shield-halved', color: '#e05a47', desc: 'Tự động khóa IP cố tình dò mật khẩu SSH hoặc phá hoại dịch vụ.' },
  { id: 'certbot', name: 'Let\'s Encrypt', icon: 'fa-solid fa-lock', color: '#ffc107', desc: 'Cài đặt Certbot để tự động đăng ký và gia hạn SSL miễn phí.' }
];

export default function Services() {
  const { apiCall, showToast, isConnected } = useVPS();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState('>> Sẵn sàng. Chờ lệnh...\n');
  const [installedSoftware, setInstalledSoftware] = useState({});

  const loadServices = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/services/list', 'POST');
      if (result.success) {
        setServices(result.data || []);
      }
    } catch (err) {
      showToast('Không thể tải trạng thái dịch vụ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkInstalledSoftware = async () => {
    try {
      // Calls SoftwareController.getInstalledSoftware
      const result = await apiCall('/api/software/installed', 'POST');
      if (result.success) {
        // Map backend output format
        const softStatus = result.data?.softwareStatus || {};
        setInstalledSoftware(softStatus);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadServices();
      checkInstalledSoftware();
    }
  }, [isConnected]);

  const handleAction = async (serviceName, action) => {
    showToast(`Đang thực hiện ${action} cho dịch vụ ${serviceName}...`, 'info');
    try {
      const result = await apiCall(`/api/services/${action}`, 'POST', { service: serviceName });
      if (result.success) {
        showToast(`Dịch vụ ${serviceName} đã ${action} thành công`, 'success');
        setLogs(prev => prev + `>> [DỊCH VỤ] ${new Date().toLocaleTimeString()}: ${action.toUpperCase()} ${serviceName} thành công.\n`);
        loadServices();
      }
    } catch (err) {
      showToast(`Không thể ${action} dịch vụ ${serviceName}`, 'error');
    }
  };

  const handleInstallSoftware = async (softwareId) => {
    if (!window.confirm(`Bạn muốn bắt đầu quá trình cài đặt ${softwareId}?`)) return;

    showToast(`Đang tiến hành cài đặt ${softwareId} ở chế độ ngầm...`, 'info');
    setLogs(prev => prev + `>> [CÀI ĐẶT] ${new Date().toLocaleTimeString()}: Bắt đầu cài đặt ${softwareId}...\n`);

    try {
      // Maps to matching installers in SoftwareController
      const endpoint = `/api/software/install-${softwareId}`;
      const result = await apiCall(endpoint, 'POST');
      if (result.success) {
        showToast(`Bắt đầu tiến trình cài đặt ${softwareId} thành công`, 'success');
        setLogs(prev => prev + `>> [CÀI ĐẶT] ${new Date().toLocaleTimeString()}: ${result.message || 'Thành công'}\n`);
        checkInstalledSoftware();
      }
    } catch (err) {
      showToast(`Lỗi cài đặt ${softwareId}`, 'error');
    }
  };

  const handleUpdateSystem = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn cập nhật toàn bộ hệ thống? (apt-get update & upgrade)')) return;

    showToast('Đang tiến hành cập nhật hệ thống...', 'info');
    try {
      const result = await apiCall('/api/software/update', 'POST');
      if (result.success) {
        showToast('Cập nhật hệ thống thành công!', 'success');
        setLogs(prev => prev + `\n>> [HỆ THỐNG] ${new Date().toLocaleTimeString()}: ${result.message || 'Đã nâng cấp xong'}`);
      }
    } catch (err) {
      showToast('Cập nhật hệ thống thất bại: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cài đặt & Quản lý Dịch vụ</h1>
          <p className="text-sm text-gray-400">Giám sát các dịch vụ daemon hệ thống và cài đặt nhanh các stack ứng dụng</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-glass flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
            onClick={() => { loadServices(); checkInstalledSoftware(); }}
            disabled={loading}
          >
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button
            className="btn-glass flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-indigo-300 border-indigo-500/20"
            onClick={handleUpdateSystem}
          >
            <ShieldCheck size={16} />
            Cập nhật hệ thống
          </button>
        </div>
      </div>

      {/* Software Installer Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Phần mềm & Stack phổ biến
        </h2>
        <div className="service-grid">
          {SOFTWARE_LIST.map(sw => {
            const isInstalled = installedSoftware[sw.id];
            return (
              <div key={sw.id} className="service-card p-5">
                {isInstalled && (
                  <span className="absolute top-4 right-4 bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    ĐÃ CÀI ĐẶT
                  </span>
                )}
                <div className="service-header mb-3">
                  <div className="service-name text-base font-bold flex items-center gap-2">
                    <i className={`${sw.icon} text-lg`} style={{ color: sw.color }}></i>
                    {sw.name}
                  </div>
                </div>
                <p className="service-info text-xs text-gray-400 leading-relaxed mb-4 flex-1">
                  {sw.desc}
                </p>
                <div className="mt-auto">
                  <button 
                    className={`btn btn-block py-2 text-xs rounded-lg font-semibold ${isInstalled ? 'btn-secondary text-gray-400' : 'btn-primary'}`}
                    onClick={() => handleInstallSoftware(sw.id)}
                  >
                    {isInstalled ? 'Cài đặt lại' : 'Cài đặt ngay'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Service Manager List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Trạng thái Dịch vụ Hệ thống
        </h2>
        {services.length === 0 ? (
          <div className="card-glass text-center py-8 text-gray-400 rounded-xl">
            {loading ? 'Đang kiểm tra các dịch vụ...' : 'Không có dịch vụ hệ thống nào được tìm thấy'}
          </div>
        ) : (
          <div className="service-grid">
            {services.map(srv => {
              const isRunning = srv.status === 'running';
              return (
                <div key={srv.name} className="service-card p-5">
                  <div className="service-header mb-3">
                    <div className="service-name text-base font-bold font-outfit">
                      {srv.name}
                    </div>
                    <span className={`service-status text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isRunning ? 'running' : 'stopped'}`}>
                      {isRunning ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>
                  <p className="service-info text-xs text-gray-400 mb-4">
                    Quản lý khởi động và cấu hình tiến trình daemon {srv.name}.
                  </p>
                  <div className="service-actions mt-auto flex gap-2">
                    {isRunning ? (
                      <button className="btn btn-secondary btn-sm flex-1 py-1.5" onClick={() => handleAction(srv.name, 'stop')}>
                        <Square size={12} /> Dừng
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm flex-1 py-1.5" onClick={() => handleAction(srv.name, 'start')}>
                        <Play size={12} /> Chạy
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm flex-1 py-1.5" onClick={() => handleAction(srv.name, 'restart')}>
                      <RotateCw size={12} /> Restart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live System Logs */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Log hoạt động
        </h2>
        <div className="card-glass p-0 overflow-hidden rounded-xl border border-white/10">
          <pre className="bg-black/60 text-green-400 p-4 font-mono text-xs h-[180px] overflow-y-auto whitespace-pre-wrap">
            {logs}
          </pre>
        </div>
      </div>
    </div>
  );
}
