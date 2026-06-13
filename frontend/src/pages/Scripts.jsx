import React, { useState } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Gauge, 
  HardDrive, 
  Cpu, 
  ShieldAlert, 
  Wifi, 
  Activity, 
  Globe, 
  Database, 
  ShieldCheck, 
  Terminal, 
  X 
} from 'lucide-react';

const SCRIPT_LIST = [
  // Tối ưu hóa hệ thống
  { id: 'bbr', name: 'Tối ưu Google BBR', icon: Gauge, color: '#e91e63', desc: 'Nâng cao tốc độ mạng và giảm độ trễ (latency) cho server bằng thuật toán BBR.' },
  { id: 'swap', name: 'Tạo RAM ảo (Swap)', icon: HardDrive, color: '#2196f3', desc: 'Tạo phân vùng Swap giúp server tránh bị crash khi hết bộ nhớ RAM thật (Tạo 2GB).' },
  { id: 'speedtest', name: 'Kiểm tra Tốc độ', icon: Wifi, color: '#4caf50', desc: 'Chạy Speedtest CLI để kiểm tra băng thông của server (Upload/Download).' },
  { id: 'bench', name: 'Bench Hiệu năng', icon: Cpu, color: '#ff9800', desc: 'Kiểm tra thông số phần cứng, tốc độ ổ cứng (IOPS) và mạng quốc tế.' },
  { id: 'warp', name: 'Cloudflare WARP', icon: ShieldAlert, color: '#673ab7', desc: 'Fake IP hoặc ẩn danh cho server thông qua mạng lưới của Cloudflare.' },
  { id: 'health', name: 'Check System Health', icon: Activity, color: '#607d8b', desc: 'Kiểm tra tổng quát sức khỏe hệ thống và các lỗi tiềm ẩn.' },
  
  // Cài đặt nhanh Web & App
  { id: 'wordpress', name: 'Cài nhanh WordPress', icon: Globe, color: '#10b981', desc: 'Tự động tải về WordPress mới nhất, tạo CSDL MySQL + User, cấu hình Nginx Virtual Host chỉ trong 1 click.', needsArgs: true },
  { id: 'phpmyadmin', name: 'Cài nhanh phpMyAdmin', icon: Database, color: '#06b6d4', desc: 'Triển khai trình quản lý CSDL trực quan phpMyAdmin qua giao diện Web cổng 8888 của Nginx.' },
  { id: 'portainer', name: 'Cài Portainer (Docker GUI)', icon: ShieldCheck, color: '#a855f7', desc: 'Khởi chạy Portainer Dashboard GUI để dễ dàng quản lý các container Docker trực quan bằng Web UI.' },
  { id: 'nodeapp', name: 'Deploy Node.js từ Git', icon: Terminal, color: '#fbbf24', desc: 'Tự động clone code từ Git (HTTPS), cài NPM dependencies và khởi chạy tiến trình PM2 tự động.', needsArgs: true }
];

export default function Scripts() {
  const { apiCall, showToast } = useVPS();
  const [logs, setLogs] = useState('>> Vui lòng chọn một script hoặc mẫu ứng dụng để bắt đầu thực thi...\n');
  const [running, setRunning] = useState(false);

  // Dynamic parameters modal states
  const [showParamsModal, setShowParamsModal] = useState(null);
  const [domain, setDomain] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [appName, setAppName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [port, setPort] = useState('3000');
  
  // WordPress admin setup states
  const [siteTitle, setSiteTitle] = useState('My WordPress Site');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const handleRunClick = (script) => {
    if (script.needsArgs) {
      setDomain('');
      setDbPassword('');
      setAppName('');
      setGitUrl('');
      setPort('3000');
      setSiteTitle('My WordPress Site');
      setAdminUser('admin');
      setAdminPass('');
      setAdminEmail('');
      setShowParamsModal(script.id);
    } else {
      executeScript(script.id);
    }
  };

  const executeScript = async (scriptId, args = null) => {
    if (!window.confirm('Bạn có chắc muốn chạy script này không? Một số script có thể thay đổi cấu hình hệ thống.')) {
      return;
    }

    setShowParamsModal(null);
    setRunning(true);
    setLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] Bắt đầu thực thi: ${scriptId}...\n`);
    showToast(`Đang chạy tác vụ cài đặt ${scriptId}...`, 'info');

    try {
      const result = await apiCall('/api/scripts/run', 'POST', { scriptId, args });

      if (result.success) {
        setLogs(prev => prev + `>> [${new Date().toLocaleTimeString()}] THỰC THI HOÀN TẤT:\n\n${result.output}\n`);
        showToast(`Tác vụ ${scriptId} đã hoàn tất thành công!`, 'success');
      } else {
        setLogs(prev => prev + `>> [${new Date().toLocaleTimeString()}] LỖI THỰC THI:\n\n${result.error}\n`);
        showToast(`Tác vụ ${scriptId} gặp lỗi!`, 'error');
      }
    } catch (err) {
      setLogs(prev => prev + `>> [LỖI KẾT NỐI]: ${err.message}\n`);
      showToast('Không thể kết nối thực thi tác vụ', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-outfit">Cài nhanh Web & Script tối ưu</h1>
        <p className="text-sm text-gray-400">Tối ưu hóa máy chủ hoặc triển khai ứng dụng tự động 1-Click không cần gõ lệnh</p>
      </div>

      <div className="service-grid">
        {SCRIPT_LIST.map(script => {
          const Icon = script.icon;
          return (
            <div key={script.id} className="service-card p-5">
              <div className="service-header mb-3">
                <div className="service-name text-base font-bold flex items-center gap-2">
                  <Icon size={18} style={{ color: script.color }} />
                  {script.name}
                </div>
              </div>
              <p className="service-info text-xs text-gray-400 leading-relaxed mb-4 flex-1">
                {script.desc}
              </p>
              <div className="mt-auto">
                <button 
                  className="btn btn-primary btn-block py-2 text-xs rounded-lg font-semibold" 
                  onClick={() => handleRunClick(script)}
                  disabled={running}
                >
                  Triển khai ngay
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Script Terminal output */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Kết quả cài đặt & Logs hệ thống (Console Output)
        </h2>
        <div className="card-glass p-0 overflow-hidden rounded-xl border border-white/10">
          <pre className="bg-black/60 text-green-400 p-4 font-mono text-xs h-[300px] overflow-y-auto whitespace-pre-wrap">
            {logs}
          </pre>
        </div>
      </div>

      {/* Dynamic Parameters Modals */}
      {showParamsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '480px' }}>
            <div className="modal-header">
              <h2>Cấu hình tham số: {SCRIPT_LIST.find(s => s.id === showParamsModal)?.name}</h2>
              <button onClick={() => setShowParamsModal(null)} className="modal-close-btn"><X size={18} /></button>
            </div>
            
            {showParamsModal === 'wordpress' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                executeScript('wordpress', { 
                  domain, 
                  db_pass: dbPassword,
                  site_title: siteTitle,
                  admin_user: adminUser,
                  admin_pass: adminPass,
                  admin_email: adminEmail
                });
              }}>
                <div className="modal-body space-y-4" style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '6px' }}>
                  <div className="form-group">
                    <label>Tên miền (Domain)</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: mywordpress.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="input-glass"
                    />
                    <small>Lưu ý: Bạn cần cấu hình DNS tên miền này trỏ về địa chỉ IP của VPS trước.</small>
                  </div>
                  <div className="form-group">
                    <label>Mật khẩu Database MySQL mới</label>
                    <input
                      type="password"
                      required
                      placeholder="Mật khẩu CSDL riêng cho WordPress"
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      className="input-glass"
                    />
                    <small>Hệ thống sẽ tự động tạo database và user tương ứng.</small>
                  </div>
                  <hr style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />
                  <div className="form-group">
                    <label>Tiêu đề Website (Site Title)</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: Blog của tôi, Shop Thời Trang..."
                      value={siteTitle}
                      onChange={(e) => setSiteTitle(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tài khoản Quản trị (Admin Username)</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: admin, manager..."
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                  <div className="form-group">
                    <label>Mật khẩu Quản trị (Admin Password)</label>
                    <input
                      type="password"
                      required
                      placeholder="Mật khẩu đăng nhập trang wp-admin"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Quản trị (Admin Email)</label>
                    <input
                      type="email"
                      required
                      placeholder="vd: admin@mywebsite.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-glass" onClick={() => setShowParamsModal(null)}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={running}>Bắt đầu cài đặt</button>
                </div>
              </form>
            )}

            {showParamsModal === 'nodeapp' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                executeScript('nodeapp', { app_name: appName, git_url: gitUrl, port });
              }}>
                <div className="modal-body space-y-4">
                  <div className="form-group">
                    <label>Tên ứng dụng</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: my-nodejs-server"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                  <div className="form-group">
                    <label>Git Repository URL (HTTPS)</label>
                    <input
                      type="url"
                      required
                      placeholder="https://github.com/username/repo.git"
                      value={gitUrl}
                      onChange={(e) => setGitUrl(e.target.value)}
                      className="input-glass"
                    />
                    <small>Hỗ trợ các kho chứa mã nguồn công khai (Public Git Repo).</small>
                  </div>
                  <div className="form-group">
                    <label>Cổng ứng dụng chạy (Port)</label>
                    <input
                      type="number"
                      required
                      placeholder="3000"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="input-glass"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-glass" onClick={() => setShowParamsModal(null)}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={running}>Triển khai ứng dụng</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
