import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { RotateCw, Power, Cpu, Trash2, Key, ShieldCheck, X } from 'lucide-react';

export default function Dashboard() {
  const { socket, apiCall, showToast, isConnected, currentVPS } = useVPS();
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

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');


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


  useEffect(() => {
    if (!isConnected) return;

    // Load static data first
    loadStaticData();

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
        <button className="btn btn-primary" onClick={loadStaticData}>
          <RotateCw size={14} /> Làm mới
        </button>
      </Topbar>

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
    </div>
  );
}
