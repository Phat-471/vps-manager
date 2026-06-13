import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { RotateCw, Power, Cpu, Trash2, Key, ShieldCheck, X, Check, Activity } from 'lucide-react';

export default function Dashboard() {
  const { socket, apiCall, showToast, isConnected, currentVPS, isPanelProtected, setupPanel, setActivePage } = useVPS();
  const [cpu, setCpu] = useState(0);
  const [ram, setRam] = useState({ usage: 0, total: 'Đang tải...', used: 'Đang tải...' });
  const [disk, setDisk] = useState({ usage: 0, total: 'Đang tải...', used: 'Đang tải...' });
  const [cpuInfo, setCpuInfo] = useState({ cores: 'Đang tải...', speed: '' });
  const [uptime, setUptime] = useState('--');
  const [systemInfo, setSystemInfo] = useState({
    os: 'Đang tải...',
    hostname: 'Đang tải...',
    arch: 'Đang tải...',
    kernel: 'Đang tải...'
  });

  // Checklist state
  const [checklist, setChecklist] = useState(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Panel Setup Password states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);


  const fetchChecklist = async () => {
    setLoadingChecklist(true);
    try {
      const res = await apiCall('/api/system/setup-check', 'POST');
      if (res.success) {
        setChecklist(res.data);
      }
    } catch (err) {
      console.error('Lỗi nạp checklist cấu hình:', err);
    } finally {
      setLoadingChecklist(false);
    }
  };

  const loadStaticData = async () => {
    try {
      const result = await apiCall('/api/system/info', 'POST');
      if (result.success) {
        setSystemInfo({
          os: result.data.os || 'Linux',
          hostname: result.data.hostname || 'unknown',
          arch: result.data.arch || 'x64',
          kernel: result.data.kernel || 'unknown'
        });
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin hệ thống:', err);
    }
  };

  const handleReboot = async () => {
    if (!window.confirm('Khởi động lại VPS có thể làm gián đoạn các website đang chạy. Bạn có chắc chắn muốn tiếp tục?')) return;
    setActionLoading(true);
    try {
      showToast('Đang gửi lệnh khởi động lại VPS...', 'info');
      const res = await apiCall('/api/system/reboot', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (err) {
      showToast('Lỗi khi gửi lệnh reboot: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCleanCache = async () => {
    setActionLoading(true);
    try {
      showToast('Đang giải phóng bộ nhớ RAM đệm (Cache)...', 'info');
      const res = await apiCall('/api/system/clean-cache', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (err) {
      showToast('Lỗi khi dọn dẹp cache: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCleanLogs = async () => {
    setActionLoading(true);
    try {
      showToast('Đang quét và dọn dẹp tệp tin rác & logs...', 'info');
      const res = await apiCall('/api/system/clean-logs', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (err) {
      showToast('Lỗi khi dọn logs: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFullUpdate = async () => {
    if (!window.confirm('Cập nhật hệ thống có thể mất vài phút. Tiếp tục?')) return;
    setActionLoading(true);
    try {
      showToast('Đang chạy tiến trình cập nhật hệ điều hành (update & upgrade)...', 'info');
      const res = await apiCall('/api/system/full-update', 'POST');
      if (res.success) {
        showToast('Đã hoàn thành cập nhật toàn bộ hệ điều hành!', 'success');
      }
    } catch (err) {
      showToast('Lỗi khi cập nhật hệ thống: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Mật khẩu nhập lại không khớp!', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      showToast('Đang thay đổi mật khẩu đăng nhập SSH...', 'info');
      const res = await apiCall('/api/system/change-password', 'POST', { newPassword });
      if (res.success) {
        showToast(res.message, 'success');
        setShowPwdModal(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      showToast('Lỗi khi đổi mật khẩu: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetupPassword = async (e) => {
    e.preventDefault();
    if (setupPassword !== setupConfirmPassword) {
      showToast('Mật khẩu nhập lại không khớp!', 'warning');
      return;
    }
    if (setupPassword.length < 6) {
      showToast('Mật khẩu phải tối thiểu 6 ký tự!', 'warning');
      return;
    }
    setSetupLoading(true);
    try {
      const result = await setupPanel(setupPassword);
      if (result.success) {
        setShowSetupModal(false);
        setSetupPassword('');
        setSetupConfirmPassword('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSetupLoading(false);
    }
  };


  useEffect(() => {
    if (!isConnected) return;

    // Load static data first
    loadStaticData();
    fetchChecklist();

    // Listen to real-time socket updates
    if (socket && currentVPS) {
      socket.emit('monitor:start', currentVPS);

      socket.on('monitor:data', (data) => {
        if (data.cpu) {
          setCpu(Math.round(data.cpu.usage));
          setCpuInfo({
            cores: `${data.cpu.cores} Cores`,
            speed: data.cpu.model || ''
          });
        }
        if (data.memory) {
          const usagePercent = Math.round(data.memory.usage);
          const totalGB = (data.memory.total / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
          const usedGB = (data.memory.used / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
          setRam({ usage: usagePercent, total: totalGB, used: usedGB });
        }
        if (data.disk) {
          const usagePercent = Math.round(data.disk.usage);
          setDisk({ 
            usage: usagePercent, 
            total: data.disk.total || 'Đang tải...', 
            used: data.disk.used || 'Đang tải...' 
          });
        }
        if (data.uptime) {
          setUptime(formatUptime(data.uptime));
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit('monitor:stop');
        socket.off('monitor:data');
      }
    };
  }, [socket, isConnected]);

  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? `${d}d ` : "";
    const hDisplay = h > 0 ? `${h}h ` : "";
    const mDisplay = m > 0 ? `${m}m ` : "";
    const sDisplay = `${s}s`;
    return dDisplay + hDisplay + mDisplay + sDisplay;
  };

  const calculateStrokeDashOffset = (percent) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius; // ~251.2
    return circumference - (percent / 100) * circumference;
  };

  return (
    <div className="content-area">
      <Topbar title="TỔNG QUAN HỆ THỐNG">
        <button className="btn btn-primary" onClick={() => { loadStaticData(); fetchChecklist(); }}>
          <RotateCw size={14} /> Làm mới
        </button>
      </Topbar>

      {/* Setup Assistant Card */}
      {checklist && (
        (!checklist.isPanelProtected || checklist.isDefaultSSHPort || !checklist.hasNginx || !checklist.hasMySQL || !checklist.hasBackupSchedules || !checklist.hasWebsites)
      ) && (
        <div className="card-glass p-6 rounded-xl mb-6 space-y-4 border border-indigo-500/10">
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                <Activity className="text-indigo-400" size={18} />
                Trợ lý Cài đặt & Tối ưu VPS lần đầu
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Thực hiện các cấu hình cơ bản dưới đây để đưa VPS của bạn vào hoạt động an toàn và ổn định.</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-indigo-300 font-semibold block mb-1">
                Hoàn thành: {
                  ((checklist.isPanelProtected ? 1 : 0) + 
                   (!checklist.isDefaultSSHPort ? 1 : 0) + 
                   ((checklist.hasNginx && checklist.hasMySQL) ? 1 : 0) + 
                   (checklist.hasBackupSchedules ? 1 : 0) + 
                   (checklist.hasWebsites ? 1 : 0))
                } / 5 bước
              </span>
              <div className="w-32 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full" 
                  style={{ 
                    width: `${
                      (((checklist.isPanelProtected ? 1 : 0) + 
                        (!checklist.isDefaultSSHPort ? 1 : 0) + 
                        ((checklist.hasNginx && checklist.hasMySQL) ? 1 : 0) + 
                        (checklist.hasBackupSchedules ? 1 : 0) + 
                        (checklist.hasWebsites ? 1 : 0)) / 5) * 100
                    }%` 
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            {/* Step 1 */}
            <div className="card-glass p-3 rounded-lg space-y-2 relative border border-white/5" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="space-y-1">
                <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Bước 1</span>
                  {checklist.isPanelProtected ? (
                    <span className="text-emerald-400 flex items-center gap-0.5 text-xs"><Check size={12} /> Đã đặt</span>
                  ) : (
                    <span className="text-yellow-400 flex items-center gap-0.5 text-xs"><X size={12} /> Chưa bảo vệ</span>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-gray-200">Mật khẩu Panel</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed">Khóa mật khẩu đăng nhập từ xa vào bảng điều khiển.</p>
              </div>
              {!checklist.isPanelProtected && (
                <button onClick={() => setShowSetupModal(true)} className="btn btn-glass btn-xs text-yellow-300 w-full mt-2" style={{ fontSize: '10px', padding: '4px' }}>
                  Đặt mật khẩu
                </button>
              )}
            </div>

            {/* Step 2 */}
            <div className="card-glass p-3 rounded-lg space-y-2 relative border border-white/5" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="space-y-1">
                <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Bước 2</span>
                  {(checklist.hasNginx && checklist.hasMySQL) ? (
                    <span className="text-emerald-400 flex items-center gap-0.5 text-xs"><Check size={12} /> Đã cài</span>
                  ) : (
                    <span className="text-yellow-400 flex items-center gap-0.5 text-xs"><X size={12} /> Thiếu dịch vụ</span>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-gray-200">Nginx & MySQL</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed">Cơ sở hạ tầng chạy Web Server & Cơ sở dữ liệu.</p>
              </div>
              {!(checklist.hasNginx && checklist.hasMySQL) && (
                <button onClick={() => setActivePage('maintenance')} className="btn btn-glass btn-xs text-yellow-300 w-full mt-2" style={{ fontSize: '10px', padding: '4px' }}>
                  Đi đến cài đặt
                </button>
              )}
            </div>

            {/* Step 3 */}
            <div className="card-glass p-3 rounded-lg space-y-2 relative border border-white/5" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="space-y-1">
                <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Bước 3</span>
                  {!checklist.isDefaultSSHPort ? (
                    <span className="text-emerald-400 flex items-center gap-0.5 text-xs"><Check size={12} /> Cổng {checklist.sshPort}</span>
                  ) : (
                    <span className="text-yellow-400 flex items-center gap-0.5 text-xs"><X size={12} /> Cổng 22 (Yếu)</span>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-gray-200">Bảo mật SSH</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed">Đổi cổng kết nối SSH để chống tấn công brute-force.</p>
              </div>
              {checklist.isDefaultSSHPort && (
                <button onClick={() => setActivePage('security')} className="btn btn-glass btn-xs text-yellow-300 w-full mt-2" style={{ fontSize: '10px', padding: '4px' }}>
                  Đổi cổng SSH
                </button>
              )}
            </div>

            {/* Step 4 */}
            <div className="card-glass p-3 rounded-lg space-y-2 relative border border-white/5" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="space-y-1">
                <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Bước 4</span>
                  {checklist.hasBackupSchedules ? (
                    <span className="text-emerald-400 flex items-center gap-0.5 text-xs"><Check size={12} /> Đã đặt</span>
                  ) : (
                    <span className="text-yellow-400 flex items-center gap-0.5 text-xs"><X size={12} /> Chưa backup</span>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-gray-200">Lập lịch Sao lưu</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed">Cấu hình backup mã nguồn & CSDL tự động hàng ngày.</p>
              </div>
              {!checklist.hasBackupSchedules && (
                <button onClick={() => setActivePage('scheduler')} className="btn btn-glass btn-xs text-yellow-300 w-full mt-2" style={{ fontSize: '10px', padding: '4px' }}>
                  Lập lịch ngay
                </button>
              )}
            </div>

            {/* Step 5 */}
            <div className="card-glass p-3 rounded-lg space-y-2 relative border border-white/5" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="space-y-1">
                <div className="flex items-center justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase">Bước 5</span>
                  {checklist.hasWebsites ? (
                    <span className="text-emerald-400 flex items-center gap-0.5 text-xs"><Check size={12} /> Hoạt động</span>
                  ) : (
                    <span className="text-yellow-400 flex items-center gap-0.5 text-xs"><X size={12} /> Trống website</span>
                  )}
                </div>
                <h4 className="text-xs font-semibold text-gray-200">Thêm Website</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed">Thêm và khởi chạy website đầu tiên trên Nginx Web Server.</p>
              </div>
              {!checklist.hasWebsites && (
                <button onClick={() => setActivePage('webserver')} className="btn btn-glass btn-xs text-yellow-300 w-full mt-2" style={{ fontSize: '10px', padding: '4px' }}>
                  Tạo Website
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warning banner fallback if setup wizard not rendered but panel unprotected */}
      {!checklist && !isPanelProtected && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px', color: '#fef3c7', fontSize: '13px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <ShieldCheck size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', color: '#f59e0b', fontWeight: '700', marginBottom: '2px' }}>Cảnh báo bảo mật: Panel chưa được đặt mật khẩu</strong>
              <span>Bảng điều khiển của bạn hiện đang mở tự do cho bất kỳ ai biết địa chỉ IP này. Vui lòng thiết lập mật khẩu bảo vệ để tránh rủi ro xâm nhập VPS trái phép.</span>
            </div>
          </div>
          <button className="btn" onClick={() => setShowSetupModal(true)} style={{ flexShrink: 0, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
            Đặt mật khẩu ngay
          </button>
        </div>
      )}

      <div className="stats-grid">
        {/* CPU Progress */}
        <div className="card stat-circle-card">
          <div className="stat-card-title">
            <span>CPU Usage</span>
            <span className="more-options">•••</span>
          </div>
          <div className="stat-circle-container">
            <svg className="stat-circle-svg" viewBox="0 0 100 100">
              <circle className="bg" cx="50" cy="50" r="40" />
              <circle 
                className="progress" 
                cx="50" 
                cy="50" 
                r="40" 
                style={{ 
                  strokeDasharray: 251.2, 
                  strokeDashoffset: calculateStrokeDashOffset(cpu),
                  stroke: '#a855f7' 
                }} 
              />
            </svg>
            <div className="stat-circle-value">
              <span className="value">{cpu}%</span>
              <span className="subtext">CPU</span>
            </div>
          </div>
          <div className="stat-card-footer">{cpuInfo.cores} ({cpuInfo.speed})</div>
        </div>

        {/* RAM Progress */}
        <div className="card stat-circle-card">
          <div className="stat-card-title">
            <span>RAM Usage</span>
            <span className="more-options">•••</span>
          </div>
          <div className="stat-circle-container">
            <svg className="stat-circle-svg" viewBox="0 0 100 100">
              <circle className="bg" cx="50" cy="50" r="40" />
              <circle 
                className="progress" 
                cx="50" 
                cy="50" 
                r="40" 
                style={{ 
                  strokeDasharray: 251.2, 
                  strokeDashoffset: calculateStrokeDashOffset(ram.usage),
                  stroke: '#06b6d4' 
                }} 
              />
            </svg>
            <div className="stat-circle-value">
              <span className="value">{ram.usage}%</span>
              <span className="subtext">RAM</span>
            </div>
          </div>
          <div className="stat-card-footer">Đã dùng: {ram.used} / {ram.total}</div>
        </div>

        {/* DISK Progress */}
        <div className="card stat-circle-card">
          <div className="stat-card-title">
            <span>Disk Usage</span>
            <span className="more-options">•••</span>
          </div>
          <div className="stat-circle-container">
            <svg className="stat-circle-svg" viewBox="0 0 100 100">
              <circle className="bg" cx="50" cy="50" r="40" />
              <circle 
                className="progress" 
                cx="50" 
                cy="50" 
                r="40" 
                style={{ 
                  strokeDasharray: 251.2, 
                  strokeDashoffset: calculateStrokeDashOffset(disk.usage),
                  stroke: '#f97316' 
                }} 
              />
            </svg>
            <div className="stat-circle-value">
              <span className="value">{disk.usage}%</span>
              <span className="subtext">DISK</span>
            </div>
          </div>
          <div className="stat-card-footer">Đã dùng: {disk.used} / {disk.total}</div>
        </div>

        {/* Uptime Card */}
        <div className="card stat-circle-card" style={{ justifyContent: 'space-between', alignItems: 'flex-start', textAlign: 'left' }}>
          <div className="stat-card-title" style={{ marginBottom: '20px' }}>
            <span>Uptime</span>
            <span className="more-options">•••</span>
          </div>
          <div style={{ margin: 'auto 0' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff', fontFamily: 'Outfit' }}>{uptime}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px' }}>Thời gian máy chủ hoạt động</div>
          </div>
          <div className="stat-card-footer">Trạng thái: Hoạt động</div>
        </div>
      </div>

      {/* System info lists */}
      <div className="grid-2">
        {/* Quick System Tools */}
        <div className="card-glass" style={{ gridColumn: 'span 2', padding: '24px' }}>
          <div className="card-header" style={{ marginBottom: '16px' }}>
            <h3 className="font-semibold text-sm tracking-wider uppercase text-gray-400">Công cụ & Phím tắt hệ thống</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            <button className="btn btn-glass" onClick={handleReboot} disabled={actionLoading} style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px', height: '100px', width: '100%' }}>
              <Power className="text-red-400" size={24} />
              <span className="text-xs font-semibold">Khởi động lại VPS</span>
            </button>
            <button className="btn btn-glass" onClick={handleCleanCache} disabled={actionLoading} style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px', height: '100px', width: '100%' }}>
              <Cpu className="text-green-400" size={24} />
              <span className="text-xs font-semibold">Giải phóng RAM Cache</span>
            </button>
            <button className="btn btn-glass" onClick={handleCleanLogs} disabled={actionLoading} style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px', height: '100px', width: '100%' }}>
              <Trash2 className="text-yellow-400" size={24} />
              <span className="text-xs font-semibold">Dọn rác & Logs</span>
            </button>
            <button className="btn btn-glass" onClick={handleFullUpdate} disabled={actionLoading} style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px', height: '100px', width: '100%' }}>
              <RotateCw className="text-indigo-300" size={24} />
              <span className="text-xs font-semibold">Cập nhật hệ điều hành</span>
            </button>
            <button className="btn btn-glass" onClick={() => setShowPwdModal(true)} disabled={actionLoading} style={{ display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px', height: '100px', width: '100%' }}>
              <Key className="text-blue-400" size={24} />
              <span className="text-xs font-semibold">Đổi mật khẩu SSH</span>
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Hệ điều hành</h3>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#a855f7', fontFamily: 'Outfit' }}>
            {systemInfo.os}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Hostname</h3>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#a855f7', fontFamily: 'Outfit' }}>
            {systemInfo.hostname}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Kiến trúc CPU</h3>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600', color: '#a855f7', fontFamily: 'Outfit' }}>
            {systemInfo.arch}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Kernel Version</h3>
          </div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#a855f7', fontFamily: 'Outfit' }}>
            {systemInfo.kernel}
          </div>
        </div>
      </div>

      {/* SSH Password Changer Modal */}
      {showPwdModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2>Đổi mật khẩu đăng nhập SSH</h2>
              <button onClick={() => setShowPwdModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    placeholder="Mật khẩu SSH mới (tối thiểu 6 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-glass"
                  />
                </div>
                <div className="form-group">
                  <label>Nhập lại mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-glass" onClick={() => setShowPwdModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Lưu mật khẩu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Panel Setup Password Modal */}
      {showSetupModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2>Thiết lập mật khẩu bảo mật Panel</h2>
              <button onClick={() => setShowSetupModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            <form onSubmit={handleSetupPassword}>
              <div className="modal-body space-y-4">
                <p className="text-xs text-gray-400 mb-2">
                  Đặt mật khẩu để khóa bảng điều khiển này. Sau khi lưu, bạn sẽ cần đăng nhập bằng mật khẩu này để truy cập tất cả tính năng quản trị từ xa.
                </p>
                <div className="form-group">
                  <label>Mật khẩu Panel mới</label>
                  <input
                    type="password"
                    required
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="input-glass"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Nhập lại mật khẩu</label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập lại mật khẩu Panel"
                    value={setupConfirmPassword}
                    onChange={(e) => setSetupConfirmPassword(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-glass" onClick={() => setShowSetupModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={setupLoading}>
                  {setupLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Kích hoạt bảo mật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
