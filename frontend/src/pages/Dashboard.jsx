import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { RotateCw, Power, Cpu, Trash2, Key, ShieldCheck, X, Check, Activity, HeartPulse, Play, Square, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { socket, apiCall, showToast, isConnected, currentVPS, isPanelProtected, setupPanel, setActivePage } = useVPS();
  const [cpu, setCpu] = useState(0);
  const [ram, setRam] = useState({ usage: 0, total: 'Đang tải...', used: 'Đang tải...' });
  const [disk, setDisk] = useState({ usage: 0, total: 'Đang tải...', used: 'Đang tải...' });

  // Lịch sử tài nguyên (Historical Stats)
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState({ cpu: true, ram: true, disk: true });
  const [hoveredPoint, setHoveredPoint] = useState(null);
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
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [setupFinishedPassword, setSetupFinishedPassword] = useState('');

  // Service Health state (Phase 6)
  const [serviceHealth, setServiceHealth] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [restartingService, setRestartingService] = useState(null);

  // Activity Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

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
        setSetupFinishedPassword(setupPassword);
        setSetupSuccess(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSetupLoading(false);
    }
  };

  const loadServiceHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await apiCall('/api/system/service-health', 'POST');
      if (res.success) setServiceHealth(res.data || []);
    } catch (err) {
      console.error('Lỗi kiểm tra health:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!isConnected || !currentVPS) return;
    setLogsLoading(true);
    try {
      const res = await apiCall('/api/logs/list', 'POST', { vpsId: currentVPS.id });
      if (res.success) {
        setLogs(res.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải nhật ký hoạt động:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ nhật ký hoạt động của Panel?')) return;
    try {
      const res = await apiCall('/api/logs/clear', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
        setLogs([]);
      }
    } catch (err) {
      showToast('Lỗi khi xóa nhật ký: ' + err.message, 'error');
    }
  };

  const fetchHistoryData = async () => {
    if (!isConnected || !currentVPS) return;
    setHistoryLoading(true);
    try {
      const res = await apiCall('/api/stats/history', 'POST');
      if (res.success) {
        setHistoryData(res.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử tài nguyên:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderHistoricalChart = () => {
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const width = 600;
    const height = 220;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const getPathD = (key) => {
      if (historyData.length === 0) return '';
      if (historyData.length === 1) {
        const x1 = paddingLeft;
        const x2 = paddingLeft + plotWidth;
        const y = paddingTop + plotHeight - (Number(historyData[0][key] || 0) / 100) * plotHeight;
        return `M ${x1} ${y} L ${x2} ${y}`;
      }
      return historyData.map((pt, idx) => {
        const x = paddingLeft + (idx / (historyData.length - 1)) * plotWidth;
        const y = paddingTop + plotHeight - (Number(pt[key] || 0) / 100) * plotHeight;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
    };

    const getAreaD = (key) => {
      if (historyData.length === 0) return '';
      const baseY = paddingTop + plotHeight;
      if (historyData.length === 1) {
        const x1 = paddingLeft;
        const x2 = paddingLeft + plotWidth;
        const y = paddingTop + plotHeight - (Number(historyData[0][key] || 0) / 100) * plotHeight;
        return `M ${x1} ${baseY} L ${x1} ${y} L ${x2} ${y} L ${x2} ${baseY} Z`;
      }
      const points = historyData.map((pt, idx) => {
        const x = paddingLeft + (idx / (historyData.length - 1)) * plotWidth;
        const y = paddingTop + plotHeight - (Number(pt[key] || 0) / 100) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const firstX = paddingLeft;
      const lastX = paddingLeft + plotWidth;
      return `M ${firstX} ${baseY} L ${points.join(' L ')} L ${lastX} ${baseY} Z`;
    };

    const getXLabels = () => {
      if (historyData.length === 0) return [];
      if (historyData.length === 1) {
        return [{
          text: new Date(historyData[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          x: paddingLeft + plotWidth / 2
        }];
      }
      const count = Math.min(5, historyData.length);
      const labels = [];
      const step = (historyData.length - 1) / (count - 1);
      for (let i = 0; i < count; i++) {
        const idx = Math.round(i * step);
        if (historyData[idx]) {
          labels.push({
            text: new Date(historyData[idx].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            x: paddingLeft + (idx / (historyData.length - 1)) * plotWidth
          });
        }
      }
      return labels;
    };

    const handleMouseMove = (e) => {
      if (historyData.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      const mouseX = e.clientX - rect.left;
      const svgX = (mouseX / rect.width) * width;
      
      let idx = 0;
      if (historyData.length > 1) {
        const relativeX = svgX - paddingLeft;
        const percentX = relativeX / plotWidth;
        idx = Math.round(percentX * (historyData.length - 1));
        if (idx < 0) idx = 0;
        if (idx >= historyData.length) idx = historyData.length - 1;
      }
      
      const xCoord = historyData.length > 1
        ? paddingLeft + (idx / (historyData.length - 1)) * plotWidth
        : paddingLeft + plotWidth / 2;

      setHoveredPoint({
        ...historyData[idx],
        index: idx,
        x: xCoord
      });
    };

    const handleMouseLeave = () => {
      setHoveredPoint(null);
    };

    return (
      <div className="card-glass p-6 rounded-xl mb-6 space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 className="font-semibold text-sm tracking-wider uppercase text-gray-400 flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity className="text-indigo-400" size={16} />
              Lịch sử sử dụng tài nguyên (24 giờ gần nhất)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Giám sát tổng quan CPU, RAM, và Dung lượng đĩa ghi nhận định kỳ mỗi 5 phút.</p>
          </div>
          
          {/* Legend Toggles */}
          <div className="flex items-center gap-4 text-xs" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="checkbox" 
                checked={visibleMetrics.cpu} 
                onChange={() => setVisibleMetrics(prev => ({ ...prev, cpu: !prev.cpu }))} 
                className="rounded border-white/10 text-purple-500 focus:ring-0 bg-white/5 cursor-pointer"
                style={{ width: '14px', height: '14px', accentColor: '#a855f7' }}
              />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%' }} />
              <span className={visibleMetrics.cpu ? 'text-gray-200' : 'text-gray-500 line-through'}>CPU</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="checkbox" 
                checked={visibleMetrics.ram} 
                onChange={() => setVisibleMetrics(prev => ({ ...prev, ram: !prev.ram }))} 
                className="rounded border-white/10 text-cyan-500 focus:ring-0 bg-white/5 cursor-pointer"
                style={{ width: '14px', height: '14px', accentColor: '#06b6d4' }}
              />
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%' }} />
              <span className={visibleMetrics.ram ? 'text-gray-200' : 'text-gray-500 line-through'}>RAM</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="checkbox" 
                checked={visibleMetrics.disk} 
                onChange={() => setVisibleMetrics(prev => ({ ...prev, disk: !prev.disk }))} 
                className="rounded border-white/10 text-orange-500 focus:ring-0 bg-white/5 cursor-pointer"
                style={{ width: '14px', height: '14px', accentColor: '#f97316' }}
              />
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%' }} />
              <span className={visibleMetrics.disk ? 'text-gray-200' : 'text-gray-500 line-through'}>Disk</span>
            </label>
          </div>
        </div>

        {historyLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: '8px' }}>
            <RefreshCw className="animate-spin text-indigo-400" size={24} />
            Đang tải dữ liệu lịch sử...
          </div>
        ) : historyData.length === 0 ? (
          <div className="py-8 text-center text-gray-400 border border-dashed border-white/10 rounded-lg" style={{ borderStyle: 'dashed', padding: '32px 0' }}>
            <Activity className="mx-auto text-gray-500 mb-2" size={32} style={{ margin: '0 auto 8px' }} />
            <p className="font-semibold text-gray-300 text-sm">Chưa có dữ liệu lịch sử tài nguyên</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto mt-1 px-4">
              Lịch sử sử dụng sẽ tự động ghi nhận cứ mỗi 5 phút một lần khi tính năng <strong>Cảnh Báo & Giám Sát</strong> được kích hoạt cho VPS này.
            </p>
            <button 
              onClick={() => setActivePage('alerts')} 
              className="btn btn-glass btn-xs text-indigo-300 mt-3"
              style={{ padding: '4px 12px', fontSize: '11px', marginTop: '12px' }}
            >
              Kích hoạt giám sát ngay
            </button>
          </div>
        ) : (
          <div className="relative w-full" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none" style={{ background: 'transparent' }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="diskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = paddingTop + ratio * plotHeight;
                const val = Math.round(100 - ratio * 100);
                return (
                  <g key={idx}>
                    <line 
                      x1={paddingLeft} 
                      y1={y} 
                      x2={width - paddingRight} 
                      y2={y} 
                      stroke="rgba(255,255,255,0.05)" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={paddingLeft - 10} 
                      y={y + 3} 
                      textAnchor="end" 
                      className="fill-gray-500 font-mono text-[9px]"
                      style={{ fill: '#6b7280' }}
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Chart Lines & Areas */}
              {visibleMetrics.disk && (
                <>
                  <path d={getAreaD('disk')} fill="url(#diskGrad)" />
                  <path d={getPathD('disk')} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
                </>
              )}
              {visibleMetrics.ram && (
                <>
                  <path d={getAreaD('ram')} fill="url(#ramGrad)" />
                  <path d={getPathD('ram')} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
                </>
              )}
              {visibleMetrics.cpu && (
                <>
                  <path d={getAreaD('cpu')} fill="url(#cpuGrad)" />
                  <path d={getPathD('cpu')} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
                </>
              )}

              {/* X Axis Labels */}
              {getXLabels().map((label, idx) => (
                <g key={idx}>
                  <line 
                    x1={label.x} 
                    y1={paddingTop + plotHeight} 
                    x2={label.x} 
                    y2={paddingTop + plotHeight + 4} 
                    stroke="rgba(255,255,255,0.15)" 
                  />
                  <text 
                    x={label.x} 
                    y={paddingTop + plotHeight + 16} 
                    textAnchor="middle" 
                    className="fill-gray-500 font-mono text-[9px]"
                    style={{ fill: '#6b7280' }}
                  >
                    {label.text}
                  </text>
                </g>
              ))}

              {/* Hover Indicator Vertical Line */}
              {hoveredPoint && (
                <line 
                  x1={hoveredPoint.x} 
                  y1={paddingTop} 
                  x2={hoveredPoint.x} 
                  y2={paddingTop + plotHeight} 
                  stroke="rgba(255,255,255,0.15)" 
                  strokeDasharray="3 3" 
                />
              )}

              {/* Hover Circles */}
              {hoveredPoint && visibleMetrics.cpu && (
                <g>
                  <circle cx={hoveredPoint.x} cy={paddingTop + plotHeight - (Number(hoveredPoint.cpu || 0) / 100) * plotHeight} r="6" fill="#a855f7" opacity="0.3" />
                  <circle cx={hoveredPoint.x} cy={paddingTop + plotHeight - (Number(hoveredPoint.cpu || 0) / 100) * plotHeight} r="3" fill="#a855f7" stroke="#fff" strokeWidth="1" />
                </g>
              )}
              {hoveredPoint && visibleMetrics.ram && (
                <g>
                  <circle cx={hoveredPoint.x} cy={paddingTop + plotHeight - (Number(hoveredPoint.ram || 0) / 100) * plotHeight} r="6" fill="#06b6d4" opacity="0.3" />
                  <circle cx={hoveredPoint.x} cy={paddingTop + plotHeight - (Number(hoveredPoint.ram || 0) / 100) * plotHeight} r="3" fill="#06b6d4" stroke="#fff" strokeWidth="1" />
                </g>
              )}
              {hoveredPoint && visibleMetrics.disk && (
                <g>
                  <circle cx={hoveredPoint.x} cy={paddingTop + plotHeight - (Number(hoveredPoint.disk || 0) / 100) * plotHeight} r="6" fill="#f97316" opacity="0.3" />
                  <circle cx={hoveredPoint.x} cy={paddingTop + plotHeight - (Number(hoveredPoint.disk || 0) / 100) * plotHeight} r="3" fill="#f97316" stroke="#fff" strokeWidth="1" />
                </g>
              )}
            </svg>

            {hoveredPoint && (
              <div 
                className="absolute pointer-events-none card-glass p-3 rounded-lg text-xs space-y-1 shadow-lg border border-white/10"
                style={{
                  left: `${(hoveredPoint.x / width) * 100}%`,
                  top: '10px',
                  transform: hoveredPoint.index > historyData.length / 2 ? 'translateX(-110%)' : 'translateX(10%)',
                  minWidth: '140px',
                  zIndex: 20,
                  pointerEvents: 'none'
                }}
              >
                <div className="font-semibold text-gray-300 border-b border-white/5 pb-1 mb-1 font-mono">
                  {new Date(hoveredPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {visibleMetrics.cpu && (
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#a855f7' }}>CPU:</span>
                    <strong className="text-white font-mono">{Number(hoveredPoint.cpu || 0).toFixed(1)}%</strong>
                  </div>
                )}
                {visibleMetrics.ram && (
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#06b6d4' }}>RAM:</span>
                    <strong className="text-white font-mono">{Number(hoveredPoint.ram || 0).toFixed(1)}%</strong>
                  </div>
                )}
                {visibleMetrics.disk && (
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#f97316' }}>Disk:</span>
                    <strong className="text-white font-mono">{Number(hoveredPoint.disk || 0).toFixed(1)}%</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleQuickService = async (serviceId, action) => {
    setRestartingService(`${serviceId}:${action}`);
    try {
      const res = await apiCall('/api/system/service-restart', 'POST', { serviceId, action });
      showToast(res.message, 'success');
      setServiceHealth(prev => prev.map(s =>
        s.id === serviceId ? { ...s, active: res.status === 'active', status: res.status } : s
      ));
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setRestartingService(null);
    }
  };


  useEffect(() => {
    if (!isConnected || !socket || !currentVPS) return;
    loadStaticData();
    fetchChecklist();
    loadServiceHealth();
    fetchHistoryData();
    fetchLogs();

    let isMonitoring = false;

    const startMonitoring = () => {
      if (!isMonitoring) {
        socket.emit('monitor:start', currentVPS);
        isMonitoring = true;
      }
    };

    const stopMonitoring = () => {
      if (isMonitoring) {
        socket.emit('monitor:stop');
        isMonitoring = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startMonitoring();
      } else {
        stopMonitoring();
      }
    };

    // Initially start monitoring if tab is active
    if (document.visibilityState === 'visible') {
      startMonitoring();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen to real-time socket updates
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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopMonitoring();
      socket.off('monitor:data');
    };
  }, [socket, isConnected, currentVPS]);

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
        <button className="btn btn-primary" onClick={() => { loadStaticData(); fetchChecklist(); loadServiceHealth(); fetchHistoryData(); }}>
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

      {/* Resource History Line Chart */}
      {renderHistoricalChart()}

      {/* Service Health Panel (Phase 6) */}
      <div className="card-glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="font-semibold text-sm tracking-wider uppercase text-gray-400" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HeartPulse size={16} className="text-rose-400" />
            Giám sát Dịch vụ (Service Health)
          </h3>
          <button onClick={loadServiceHealth} disabled={healthLoading} className="btn btn-glass" style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RotateCw size={12} className={healthLoading ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
        {healthLoading && serviceHealth.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">Đang kiểm tra trạng thái dịch vụ...</div>
        ) : serviceHealth.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">Không tìm thấy dịch vụ nào đang chạy.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {serviceHealth.map(svc => {
              const isRestarting = restartingService?.startsWith(svc.id + ':');
              return (
                <div key={svc.id} className="card-glass rounded-xl p-3" style={{
                  border: svc.active ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)',
                  background: svc.active ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>
                      {svc.icon} {svc.name}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                      background: svc.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: svc.active ? '#34d399' : '#f87171'
                    }}>
                      {svc.active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {!svc.active && (
                      <button
                        onClick={() => handleQuickService(svc.id, 'start')}
                        disabled={isRestarting}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px', borderRadius: '5px', background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)', cursor: isRestarting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                      >
                        <Play size={9} /> Start
                      </button>
                    )}
                    {svc.active && (
                      <button
                        onClick={() => handleQuickService(svc.id, 'restart')}
                        disabled={isRestarting}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px', borderRadius: '5px', background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', cursor: isRestarting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
                      >
                        <RefreshCw size={9} className={isRestarting ? 'animate-spin' : ''} /> Restart
                      </button>
                    )}
                    {svc.active && (
                      <button
                        onClick={() => handleQuickService(svc.id, 'stop')}
                        disabled={isRestarting}
                        style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '5px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: isRestarting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Square size={9} /> Stop
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nhật ký hoạt động */}
      <div className="card-glass mt-6 animate-fade-in" style={{ padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="font-semibold text-sm tracking-wider uppercase text-gray-400 style-title flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} className="text-indigo-400" />
            Nhật ký hoạt động Panel (Activity Logs)
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={fetchLogs} disabled={logsLoading} className="btn btn-glass btn-xs" style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RotateCw size={12} className={logsLoading ? 'animate-spin' : ''} /> Làm mới
            </button>
            {logs.length > 0 && (
              <button onClick={handleClearLogs} className="btn btn-glass btn-xs text-red-400" style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(239,68,68,0.1)', border: 'none' }}>
                Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {logsLoading && logs.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">Đang tải nhật ký...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">Chưa ghi nhận hoạt động nào.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: '600' }}>Thời gian</th>
                  <th style={{ padding: '8px 12px', fontWeight: '600' }}>Hành động</th>
                  <th style={{ padding: '8px 12px', fontWeight: '600' }}>Chi tiết</th>
                  <th style={{ padding: '8px 12px', fontWeight: '600' }}>Người dùng</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 10).map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#a5b4fc' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ 
                        background: 'rgba(99,102,241,0.15)', 
                        color: '#a5b4fc', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>{log.details}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{log.username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length > 10 && (
              <div style={{ textAlign: 'center', marginTop: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                Hiển thị 10 trong tổng số {logs.length} hoạt động gần đây
              </div>
            )}
          </div>
        )}
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
              <button 
                onClick={() => {
                  setShowSetupModal(false);
                  setSetupSuccess(false);
                  setSetupPassword('');
                  setSetupConfirmPassword('');
                  setSetupFinishedPassword('');
                }} 
                className="modal-close-btn"
              >
                <X size={18} />
              </button>
            </div>
            {!setupSuccess ? (
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
                  <button 
                    type="button" 
                    className="btn btn-glass" 
                    onClick={() => {
                      setShowSetupModal(false);
                      setSetupPassword('');
                      setSetupConfirmPassword('');
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={setupLoading}>
                    {setupLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Kích hoạt bảo mật'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-body space-y-4 py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 mb-2">
                  <Check size={24} />
                </div>
                <h3 className="text-base font-bold text-emerald-400">Thiết lập bảo mật thành công!</h3>
                <p className="text-xs text-gray-400">
                  Panel đã được kích hoạt chế độ bảo mật. Vui lòng tải xuống thông tin đăng nhập này hoặc lưu lại để tránh mất quyền truy cập.
                </p>
                
                <div className="bg-white/5 rounded-lg p-3 text-left space-y-2 text-xs border border-white/10 font-mono">
                  <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-gray-400">Cổng Panel (Port):</span>
                    <span className="text-indigo-300 font-semibold">{window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}</span>
                  </div>
                  <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-gray-400">Tài khoản (User):</span>
                    <span className="text-indigo-300 font-semibold">admin</span>
                  </div>
                  <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-gray-400">Mật khẩu (Pass):</span>
                    <span className="text-indigo-300 font-semibold">{setupFinishedPassword}</span>
                  </div>
                  <div className="border-t border-white/5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    <span className="text-gray-400 block mb-1" style={{ display: 'block', marginBottom: '4px' }}>Đường dẫn đăng nhập tự động:</span>
                    <div className="text-[10px] text-gray-300 break-all select-all p-1 bg-black/20 rounded border border-white/5" style={{ wordBreak: 'break-all', padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      {`${window.location.protocol}//${window.location.host}/?password=${encodeURIComponent(setupFinishedPassword)}`}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
                  <button 
                    onClick={() => {
                      const loginLink = `${window.location.protocol}//${window.location.host}/?password=${encodeURIComponent(setupFinishedPassword)}`;
                      const content = `=======================================\nTHÔNG TIN ĐĂNG NHẬP PANEL VPS MANAGER\n=======================================\n\nCổng Panel (Port): ${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}\nTài khoản (User): admin\nMật khẩu (Pass): ${setupFinishedPassword}\n\nLiên kết truy cập đăng nhập tự động:\n${loginLink}\n\n=======================================`;
                      
                      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                      const element = document.createElement('a');
                      element.href = URL.createObjectURL(blob);
                      element.download = `vps_panel_credentials_${window.location.hostname}.txt`;
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                      showToast('Đã tải tệp thông tin đăng nhập về máy!', 'success');
                    }}
                    className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-semibold"
                    style={{ width: '100%', padding: '10px 0' }}
                  >
                    Lưu thông tin đăng nhập về máy
                  </button>
                  <button 
                    onClick={() => {
                      setShowSetupModal(false);
                      setSetupSuccess(false);
                      setSetupPassword('');
                      setSetupConfirmPassword('');
                      setSetupFinishedPassword('');
                    }}
                    className="btn btn-glass w-full py-2.5 font-semibold"
                    style={{ width: '100%', padding: '10px 0' }}
                  >
                    Hoàn tất & Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
