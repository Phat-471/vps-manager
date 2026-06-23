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

const INSTALL_COMMANDS = {
  lemp: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx mysql-server php-fpm php-mysql && systemctl enable nginx && systemctl enable mysql && systemctl start nginx && systemctl start mysql",
  nginx: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx && systemctl enable nginx && systemctl start nginx && nginx -v",
  mysql: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server && systemctl enable mysql && systemctl start mysql && mysql --version",
  php: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y php-fpm php-mysql php-cli php-common php-curl php-gd php-mbstring php-xml && FPM_SERVICE=$(systemctl list-units --type=service --all | grep php | grep fpm | awk '{print $1}' | head -1) && if [ -n \"$FPM_SERVICE\" ]; then systemctl enable $FPM_SERVICE && systemctl start $FPM_SERVICE; fi && php -v",
  apache: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y apache2 && systemctl enable apache2 && systemctl start apache2 && apache2 -v",
  nodejs: "curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs && npm install -g pm2 && if ! id -u pm2user &>/dev/null; then useradd -m -s /bin/bash pm2user; fi && pm2 startup systemd 2>/dev/null || true && node --version && npm --version && pm2 --version",
  docker: "apt-get update && apt-get install -y ca-certificates curl gnupg && install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && chmod a+r /etc/apt/keyrings/docker.gpg && echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable\" | tee /etc/apt/sources.list.d/docker.list > /dev/null && apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && systemctl enable docker && systemctl start docker && docker --version",
  java: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jdk openjdk-17-jre && java -version",
  mongodb: "curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor && echo \"deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse\" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org && systemctl enable mongod && systemctl start mongod && mongod --version",
  redis: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server && systemctl enable redis-server && systemctl start redis-server && redis-cli --version",
  golang: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y golang-go && go version",
  fail2ban: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban && systemctl enable fail2ban && systemctl start fail2ban && fail2ban-client --version",
  certbot: "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx && certbot --version"
};

const UNINSTALL_COMMANDS = {
  nginx: 'apt-get purge -y nginx nginx-common nginx-core && apt-get autoremove -y',
  mysql: 'apt-get purge -y mysql-server mysql-client mysql-common && apt-get autoremove -y',
  php: 'apt-get purge -y php-fpm php-cli php-common php-mysql php-curl php-gd php-mbstring php-xml php-zip php-bcmath php-soap php-intl php-readline && apt-get autoremove -y',
  nodejs: 'apt-get purge -y nodejs && apt-get autoremove -y && rm -rf $HOME/.nvm /root/.nvm',
  docker: 'apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && apt-get autoremove -y',
  java: 'apt-get purge -y openjdk-17-jdk openjdk-17-jre && apt-get autoremove -y',
  mongodb: 'apt-get purge -y mongodb-org mongodb-org-server mongodb-org-shell mongodb-org-mongos mongodb-org-tools && apt-get autoremove -y',
  redis: 'apt-get purge -y redis-server redis-tools && apt-get autoremove -y',
  golang: 'apt-get purge -y golang-go && apt-get autoremove -y',
  fail2ban: 'apt-get purge -y fail2ban && apt-get autoremove -y',
  certbot: 'apt-get purge -y certbot python3-certbot-nginx && apt-get autoremove -y',
  composer: 'rm -f /usr/local/bin/composer',
  apache: 'apt-get purge -y apache2 && apt-get autoremove -y',
  lemp: 'apt-get purge -y nginx nginx-common nginx-core mysql-server mysql-client mysql-common php-fpm php-cli php-common php-mysql && apt-get autoremove -y'
};

export default function Services() {
  const { apiCall, showToast, isConnected, socket, currentVPS } = useVPS();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
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
      const result = await apiCall('/api/software/installed', 'POST');
      if (result.success) {
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

  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data) => {
      setLogs(prev => prev + data);
    };

    const handleEnded = ({ code, error }) => {
      setLoading(false);
      setRunning(false);
      if (code === 0) {
        setLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] THÀNH CÔNG: Hoàn tất tiến trình cài đặt/gỡ phần mềm!\n`);
        showToast('Hoàn tất tiến trình thành công!', 'success');
        checkInstalledSoftware();
        loadServices();
      } else {
        const errMsg = error || `Mã lỗi trả về: ${code}`;
        setLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] THẤT BẠI: ${errMsg}\n`);
        showToast('Thao tác thất bại: ' + errMsg, 'error');
      }
    };

    socket.on('task:output', handleOutput);
    socket.on('task:ended', handleEnded);

    return () => {
      socket.off('task:output', handleOutput);
      socket.off('task:ended', handleEnded);
    };
  }, [socket]);

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
    if (!isConnected || !socket) {
      showToast('Không thể kết nối WebSocket. Vui lòng kết nối VPS trước.', 'error');
      return;
    }
    const cmd = INSTALL_COMMANDS[softwareId];
    if (!cmd) {
      showToast(`Không tìm thấy lệnh cài đặt cho ${softwareId}`, 'error');
      return;
    }
    if (!window.confirm(`Bạn muốn bắt đầu quá trình cài đặt ${softwareId}?`)) return;

    setLoading(true);
    setRunning(true);
    setLogs(`>> [CÀI ĐẶT] ${new Date().toLocaleTimeString()}: Bắt đầu cài đặt ${softwareId}...\n`);
    socket.emit('task:run', {
      vpsConfig: currentVPS,
      command: cmd
    });
  };

  const handleUninstallSoftware = async (softwareId) => {
    if (!isConnected || !socket) {
      showToast('Không thể kết nối WebSocket. Vui lòng kết nối VPS trước.', 'error');
      return;
    }
    const cmd = UNINSTALL_COMMANDS[softwareId];
    if (!cmd) {
      showToast(`Không tìm thấy lệnh gỡ cài đặt cho ${softwareId}`, 'error');
      return;
    }
    if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn gỡ cài đặt hoàn toàn ${softwareId} khỏi VPS? Thao tác này sẽ xóa mọi cấu hình và tệp liên quan.`)) return;

    setLoading(true);
    setRunning(true);
    setLogs(`>> [GỠ CÀI ĐẶT] ${new Date().toLocaleTimeString()}: Bắt đầu gỡ cài đặt ${softwareId}...\n`);
    socket.emit('task:run', {
      vpsConfig: currentVPS,
      command: cmd
    });
  };

  const handleUpdateSystem = async () => {
    if (!isConnected || !socket) {
      showToast('Không thể kết nối WebSocket. Vui lòng kết nối VPS trước.', 'error');
      return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn cập nhật toàn bộ hệ thống? (apt-get update & upgrade)')) return;

    setLoading(true);
    setRunning(true);
    setLogs(`>> [HỆ THỐNG] ${new Date().toLocaleTimeString()}: Bắt đầu cập nhật hệ thống...\n`);
    socket.emit('task:run', {
      vpsConfig: currentVPS,
      command: 'apt-get update && apt-get upgrade -y'
    });
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
                  {isInstalled ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary py-2 text-xs rounded-lg font-semibold flex-grow"
                        onClick={() => handleInstallSoftware(sw.id)}
                        style={{ padding: '8px 4px' }}
                      >
                        Cài lại
                      </button>
                      <button 
                        className="btn btn-danger py-2 text-xs rounded-lg font-semibold flex-grow"
                        onClick={() => handleUninstallSoftware(sw.id)}
                        style={{ padding: '8px 4px' }}
                      >
                        Gỡ
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-block py-2 text-xs rounded-lg font-semibold btn-primary"
                      onClick={() => handleInstallSoftware(sw.id)}
                    >
                      Cài đặt ngay
                    </button>
                  )}
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
