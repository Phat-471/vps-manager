import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import {
  Server,
  RefreshCw,
  Trash2,
  Globe,
  Search,
  Cloud,
  Cpu,
  HardDrive,
  ExternalLink,
  Settings,
  Download,
  Eye,
  EyeOff,
  Copy,
  AlertCircle
} from 'lucide-react';

// Thành phần Vẽ biểu đồ đường dạng SVG nhẹ, tự chế để không phụ thuộc thư viện NPM bên thứ 3
function SVGLineChart({ data, keys, colors, labels, maxVal = 100 }) {
  if (!data || data.length === 0) return (
    <div className="h-44 flex items-center justify-center text-xs text-gray-500 italic">
      Chưa có dữ liệu biểu đồ
    </div>
  );

  const width = 600;
  const height = 160;
  const paddingTop = 15;
  const paddingBottom = 20;
  const paddingLeft = 45;
  const paddingRight = 15;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  let dynamicMax = maxVal;
  if (maxVal === 'auto') {
    let vals = [];
    data.forEach(d => {
      keys.forEach(k => {
        vals.push(Number(d[k]) || 0);
      });
    });
    dynamicMax = Math.max(...vals, 1);
  }

  const xTickInterval = Math.max(1, Math.floor(data.length / 10));

  const paths = keys.map(key => {
    return data.map((d, index) => {
      const val = Number(d[key]) || 0;
      const x = paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
      const y = paddingTop + chartHeight - (val / dynamicMax) * chartHeight;
      return { x, y };
    });
  });

  return (
    <div className="w-full overflow-x-auto pt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 font-mono text-[9px] fill-gray-400">
        {/* Y Grid lines & ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight - ratio * chartHeight;
          const val = ratio * dynamicMax;
          const valStr = dynamicMax > 1024 * 1024 
            ? (val / (1024 * 1024)).toFixed(1) + ' MB'
            : val.toFixed(0);
          return (
            <g key={idx}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <text x={paddingLeft - 10} y={y + 3} textAnchor="end" className="fill-gray-500">
                {valStr}{maxVal === 100 ? '%' : ''}
              </text>
            </g>
          );
        })}

        {/* X labels (timestamps) */}
        {data.map((d, index) => {
          if (index % xTickInterval !== 0 && index !== data.length - 1) return null;
          const x = paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
          const time = d.timestamp ? d.timestamp.split(' ')[1].substring(0, 5) : '';
          return (
            <g key={index}>
              <line x1={x} y1={paddingTop} x2={x} y2={paddingTop + chartHeight} stroke="rgba(255,255,255,0.02)" />
              <text x={x} y={height - 4} textAnchor="middle" className="fill-gray-500">{time}</text>
            </g>
          );
        })}

        {/* Line paths */}
        {paths.map((pts, idx) => {
          if (pts.length < 2) return null;
          const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
          const strokeColor = colors[idx] || '#a855f7';
          return (
            <polyline
              key={idx}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsStr}
            />
          );
        })}
      </svg>
    </div>
  );
}

// Sparkline nhỏ cho cột bảng
function Sparkline({ points }) {
  if (!points || points.length < 2) {
    return <span className="text-[10px] text-gray-500 italic">Chưa có stats</span>;
  }
  const width = 80;
  const height = 24;
  const wStep = width / (points.length - 1 || 1);
  const pts = points.map((val, i) => {
    const x = i * wStep;
    const y = height - (val / 100) * 20 - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline fill="none" stroke="#a855f7" strokeWidth="1.8" points={pts} />
    </svg>
  );
}

export default function CentralMonitor() {
  const { apiCall, showToast } = useVPS();
  const [config, setConfig] = useState({ url: '', hasToken: false });
  const [configInput, setConfigInput] = useState({ url: '', token: '' });
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Dữ liệu cài đặt VPS
  const [installations, setInstallations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalId, setRefreshIntervalId] = useState(null);

  // Xem chi tiết tài nguyên VPS
  const [selectedVPS, setSelectedVPS] = useState(null);
  const [statsHistory, setStatsHistory] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Quản lý hiển thị mật khẩu
  const [visiblePasswords, setVisiblePasswords] = useState({});

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config.url) {
      loadInstallations();
    }
  }, [config.url]);

  // Thiết lập interval auto refresh
  useEffect(() => {
    if (autoRefresh && config.url) {
      const id = setInterval(() => {
        loadInstallations(true); // load thầm lặng không bật loading spinner
      }, 10000);
      setRefreshIntervalId(id);
      return () => clearInterval(id);
    } else {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        setRefreshIntervalId(null);
      }
    }
  }, [autoRefresh, config.url]);

  const fetchConfig = async () => {
    try {
      const res = await apiCall('/api/central-monitor/config', 'GET');
      if (res.success) {
        setConfig({ url: res.url, hasToken: res.hasToken });
        setConfigInput({ url: res.url, token: '' });
        if (!res.url) {
          setShowConfig(true);
        }
      }
    } catch (err) {
      showToast('Không thể lấy cấu hình máy chủ giám sát', 'error');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await apiCall('/api/central-monitor/config', 'POST', {
        url: configInput.url,
        token: configInput.token
      });
      if (res.success) {
        showToast(res.message, 'success');
        setConfig({ url: configInput.url, hasToken: !!configInput.token });
        setShowConfig(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const loadInstallations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiCall('/api/central-monitor/list', 'GET');
      if (res.success) {
        setInstallations(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDeleteRecord = async (vpsId, ip) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản ghi cài đặt của VPS IP: ${ip} khỏi hệ thống giám sát trung tâm?`)) return;
    try {
      const res = await apiCall('/api/central-monitor/delete', 'POST', { vpsId });
      if (res.success) {
        showToast(res.message, 'success');
        loadInstallations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openStatsModal = async (vps) => {
    setSelectedVPS(vps);
    setStatsHistory([]);
    setModalLoading(true);
    try {
      const res = await apiCall(`/api/central-monitor/stats?ip=${encodeURIComponent(vps.ip)}`, 'GET');
      if (res.success) {
        setStatsHistory(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const togglePassword = (id) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (text, msg) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg, 'success');
    });
  };

  const downloadCredentials = (vps) => {
    const loginLink = `http://${vps.ip}:${vps.port}/?password=${encodeURIComponent(vps.password)}`;
    const content = `=======================================\nTHÔNG TIN ĐĂNG NHẬP PANEL VPS MANAGER\n=======================================\n\nĐịa chỉ IP VPS: ${vps.ip}\nCổng Panel (Port): ${vps.port}\nTài khoản (User): admin\nMật khẩu (Pass): ${vps.password}\n\nLiên kết truy cập đăng nhập tự động:\n${loginLink}\n\n=======================================`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `vps_panel_credentials_${vps.ip}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Lọc danh sách VPS theo tìm kiếm và trạng thái
  let filteredList = installations;
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    filteredList = filteredList.filter(item => 
      item.ip.toLowerCase().includes(q) || 
      item.os.toLowerCase().includes(q) || 
      item.status.toLowerCase().includes(q)
    );
  }

  if (filterStatus === 'online') {
    filteredList = filteredList.filter(item => item.online === 'online');
  } else if (filterStatus === 'installing') {
    filteredList = filteredList.filter(item => item.status === 'installing');
  } else if (filterStatus === 'failed') {
    filteredList = filteredList.filter(item => item.status === 'failed');
  }

  // Đảo ngược mảng để VPS mới nhất xuất hiện lên đầu
  const reversedList = [...filteredList].reverse();

  // Thống kê KPIs
  const totalCount = installations.length;
  const successCount = installations.filter(i => i.status === 'success').length;
  const installingCount = installations.filter(i => i.status === 'installing').length;
  const failedCount = installations.filter(i => i.status === 'failed').length;

  const quickCommand = config.url ? `curl -sSL ${config.url} | bash` : 'Chưa cấu hình Server trung tâm';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="explorer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cloud className="text-indigo-400" />
            Giám sát & Cài đặt Trung tâm
          </h1>
          <p className="text-sm text-gray-400">
            Theo dõi tiến trình cài đặt VPS 1-Click động và giám sát tài nguyên tập trung của mọi máy chủ.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="btn btn-glass flex items-center gap-2"
          >
            <Settings size={16} />
            Cấu hình Server
          </button>
          {config.url && (
            <button
              onClick={() => loadInstallations()}
              disabled={loading}
              className="btn btn-primary flex items-center gap-2"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* Form cấu hình */}
      {showConfig && (
        <div className="card-glass p-6 rounded-xl border border-indigo-500/20">
          <h3 className="text-sm font-semibold text-indigo-300 mb-4 flex items-center gap-2">
            <Settings size={16} />
            Thiết lập Máy chủ Phân phối & Giám sát trung tâm (Cai)
          </h3>
          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group col-span-2">
              <label>Đường dẫn API Trung tâm (URL)</label>
              <input
                type="url"
                required
                value={configInput.url}
                onChange={(e) => setConfigInput(prev => ({ ...prev, url: e.target.value }))}
                className="input-glass"
                placeholder="Ví dụ: https://ten-mien-cua-ban.com/cai"
              />
              <small className="text-gray-500">
                Thư mục chứa mã nguồn PHP (`index.php`, `stats.php`, `log.php`, `monitor.php`) phân phối script.
              </small>
            </div>
            <div className="form-group col-span-2">
              <label>Security Token</label>
              <input
                type="password"
                value={configInput.token}
                onChange={(e) => setConfigInput(prev => ({ ...prev, token: e.target.value }))}
                className="input-glass"
                placeholder={config.hasToken ? "•••••••• (Token đã lưu, nhập token mới để đổi)" : "Nhập Security Token bảo mật..."}
              />
              <small className="text-gray-500">
                Khóa bảo mật (`$SECURITY_TOKEN`) trùng khớp với cấu hình trong file `cai/config.php` để được xác thực.
              </small>
            </div>
            <div className="col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="btn btn-glass"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="btn btn-primary"
              >
                {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kiểm tra cấu hình */}
      {!config.url ? (
        <div className="card-glass p-8 text-center text-gray-400 border border-indigo-500/20 bg-indigo-500/5">
          <AlertCircle size={36} className="mx-auto mb-3 text-indigo-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-200">Chưa cấu hình máy chủ giám sát</h3>
          <p className="text-sm mt-1 max-w-lg mx-auto">
            Vui lòng nhấn vào nút **Cấu hình Server** phía trên, nhập địa chỉ URL chứa thư mục `/cai` và Token bảo mật để kích hoạt giao diện giám sát trung tâm.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card-glass p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block mb-1">Tổng VPS cài đặt</span>
                <strong className="text-2xl font-bold font-outfit text-white">{totalCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Server size={20} />
              </div>
            </div>

            <div className="card-glass p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block mb-1">Cài đặt thành công</span>
                <strong className="text-2xl font-bold font-outfit text-emerald-400">{successCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Server size={20} />
              </div>
            </div>

            <div className="card-glass p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block mb-1">Đang tiến hành</span>
                <strong className="text-2xl font-bold font-outfit text-blue-400">{installingCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 animate-pulse">
                <Server size={20} />
              </div>
            </div>

            <div className="card-glass p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block mb-1">Cài đặt thất bại</span>
                <strong className="text-2xl font-bold font-outfit text-red-400">{failedCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 text-red-400">
                <Server size={20} />
              </div>
            </div>
          </div>

          {/* Quick command copy */}
          <div className="card-glass p-4 rounded-xl border-l-4 border-indigo-500 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-400 block mb-1">Lệnh cài đặt tự động nhanh (cURL 1-Click) cho VPS mới:</span>
              <code className="text-indigo-400 text-xs block truncate bg-black/30 p-2.5 rounded font-mono">
                {quickCommand}
              </code>
            </div>
            <button
              onClick={() => copyToClipboard(quickCommand, 'Đã copy lệnh cài đặt nhanh vào bộ nhớ tạm!')}
              className="btn btn-primary btn-sm flex-shrink-0"
            >
              Copy lệnh
            </button>
          </div>

          {/* Controls row */}
          <div className="flex justify-between items-center gap-4 flex-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div className="relative flex-1 min-w-[280px]" style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={16} className="text-gray-500" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-glass"
                style={{ paddingLeft: '40px' }}
                placeholder="Tìm kiếm IP, OS, trạng thái..."
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-lg gap-1">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${filterStatus === 'all' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterStatus('online')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${filterStatus === 'online' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Online
                </button>
                <button
                  onClick={() => setFilterStatus('installing')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${filterStatus === 'installing' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Đang cài
                </button>
                <button
                  onClick={() => setFilterStatus('failed')}
                  className={`px-3 py-1 rounded text-xs font-semibold ${filterStatus === 'failed' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Thất bại
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="sr-only peer"
                    style={{ display: 'none' }}
                  />
                  <div className={`w-8 h-4 bg-white/10 rounded-full peer transition-all duration-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all ${autoRefresh ? 'bg-indigo-500 after:translate-x-4 after:bg-white' : ''}`} style={{ position: 'relative' }}></div>
                </label>
                <span>Live Auto Refresh</span>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="card-glass p-0 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">Danh sách máy chủ VPS cài đặt</h3>
              <span className="text-[11px] text-gray-500">Nhấp vào IP bất kỳ để mở Biểu đồ giám sát tài nguyên 24h</span>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 font-mono text-[10px] uppercase tracking-wider bg-white/[0.02]">
                    <th className="py-3 px-5">IP VPS</th>
                    <th className="py-3 px-4">Hệ điều hành</th>
                    <th className="py-3 px-4">Cổng</th>
                    <th className="py-3 px-4">Mật khẩu</th>
                    <th className="py-3 px-4">Trạng thái cài</th>
                    <th className="py-3 px-4">Ngày cập nhật</th>
                    <th className="py-3 px-4">Sparkline CPU</th>
                    <th className="py-3 px-5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reversedList.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-gray-500 italic">
                        {loading ? 'Đang tải danh sách VPS...' : 'Không tìm thấy dữ liệu nào.'}
                      </td>
                    </tr>
                  ) : (
                    reversedList.map((vps) => {
                      const isInstalling = vps.status === 'installing';
                      
                      // Dấu chấm trạng thái Online/Offline
                      let statusDot = 'bg-gray-500';
                      let statusTitle = 'Offline (Mất kết nối)';
                      if (isInstalling) {
                        statusDot = 'bg-blue-500 animate-pulse';
                        statusTitle = 'Đang tiến hành cài đặt';
                      } else if (vps.online === 'online') {
                        statusDot = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
                        statusTitle = 'Online (Hoạt động)';
                      }

                      return (
                        <tr key={vps.id} className="hover:bg-white/[0.01]">
                          <td className="py-3 px-5 font-mono">
                            <span className={`w-2 h-2 rounded-full inline-block mr-2 align-middle ${statusDot}`} title={statusTitle} />
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); openStatsModal(vps); }}
                              className="text-indigo-400 font-semibold hover:text-indigo-300 border-b border-dashed border-indigo-400/30"
                            >
                              {vps.ip}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{vps.os}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-indigo-300">{vps.port || '--'}</td>
                          <td className="py-3 px-4">
                            {vps.password && vps.password !== '••••••••' ? (
                              <div className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/5 font-mono">
                                <span className="text-gray-300 text-[11px]">
                                  {visiblePasswords[vps.id] ? vps.password : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePassword(vps.id)}
                                  className="text-gray-400 hover:text-white p-0.5"
                                  title={visiblePasswords[vps.id] ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                >
                                  {visiblePasswords[vps.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                                </button>
                                <button
                                  onClick={() => copyToClipboard(vps.password, 'Đã copy mật khẩu VPS vào Clipboard')}
                                  className="text-gray-400 hover:text-white p-0.5"
                                  title="Copy mật khẩu"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            ) : vps.password === '••••••••' ? (
                              <span className="text-gray-500 italic text-[11px]">Ẩn (Quyền Staff)</span>
                            ) : (
                              <span className="text-gray-500">--</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {vps.status === 'success' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Thành công
                              </span>
                            )}
                            {vps.status === 'installing' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                                Đang cài...
                              </span>
                            )}
                            {vps.status === 'failed' && (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 cursor-help"
                                title={vps.message}
                              >
                                Thất bại
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">{vps.updatedAt}</td>
                          <td className="py-3 px-4">
                            <Sparkline points={vps.cpuPoints} />
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="flex justify-end gap-2">
                              {vps.status === 'success' && vps.password !== '••••••••' && (
                                <button
                                  onClick={() => downloadCredentials(vps)}
                                  className="btn btn-glass btn-xs"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  title="Tải file text thông tin đăng nhập"
                                >
                                  <Download size={12} />
                                  Tải file
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRecord(vps.id, vps.ip)}
                                className="btn btn-glass btn-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                              >
                                <Trash2 size={12} />
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal biểu đồ tài nguyên chi tiết */}
      {selectedVPS && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '650px', maxWidth: '95%' }}>
            <div className="modal-header">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Server size={18} className="text-indigo-400" />
                  Giám sát tài nguyên máy chủ: {selectedVPS.ip}
                </h2>
                <span className="text-[11px] text-gray-400 mt-1 block">Hệ điều hành: {selectedVPS.os}</span>
              </div>
              <button
                onClick={() => setSelectedVPS(null)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>
            <div className="modal-body space-y-5">
              {modalLoading ? (
                <div className="py-12 text-center text-gray-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  Đang tải biểu đồ tài nguyên từ trung tâm...
                </div>
              ) : statsHistory.length === 0 ? (
                <div className="py-12 text-center text-gray-500 italic">
                  Không tìm thấy lịch sử lưu trữ tài nguyên của máy chủ này. (Đợi cron job chạy gửi thông số lần đầu).
                </div>
              ) : (
                <>
                  {/* KPIs thô hiện tại */}
                  <div className="grid grid-cols-3 gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                      <span className="text-[10px] text-gray-400 block mb-0.5">CPU Hiện tại</span>
                      <strong className="text-sm font-mono text-white">
                        {Number(statsHistory[statsHistory.length - 1].cpu).toFixed(1)} %
                      </strong>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                      <span className="text-[10px] text-gray-400 block mb-0.5">RAM Sử dụng</span>
                      <strong className="text-sm font-mono text-white">
                        {Number(statsHistory[statsHistory.length - 1].ram).toFixed(1)} %
                      </strong>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                      <span className="text-[10px] text-gray-400 block mb-0.5">Disk Đầy</span>
                      <strong className="text-sm font-mono text-white">
                        {Number(statsHistory[statsHistory.length - 1].disk).toFixed(1)} %
                      </strong>
                    </div>
                  </div>

                  {/* Biểu đồ Tài nguyên */}
                  <div className="card-glass p-4 rounded-xl">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                      <Cpu size={14} className="text-indigo-400" />
                      Lịch sử sử dụng hệ thống (24 giờ gần nhất)
                    </h4>
                    <div className="flex gap-4 mb-2 text-[10px] text-gray-500 font-semibold justify-center">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-purple-500 inline-block rounded-full"></span> CPU (%)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-cyan-500 inline-block rounded-full"></span> RAM (%)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-orange-500 inline-block rounded-full"></span> Disk (%)</span>
                    </div>
                    <SVGLineChart
                      data={statsHistory}
                      keys={['cpu', 'ram', 'disk']}
                      colors={['#a855f7', '#06b6d4', '#f97316']}
                      maxVal={100}
                    />
                  </div>

                  {/* Biểu đồ Băng thông */}
                  <div className="card-glass p-4 rounded-xl">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                      <HardDrive size={14} className="text-indigo-400" />
                      Lưu lượng mạng Mạng RX/TX (Tính bằng MB)
                    </h4>
                    <div className="flex gap-4 mb-2 text-[10px] text-gray-500 font-semibold justify-center">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-blue-500 inline-block rounded-full"></span> RX (Download)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-pink-500 inline-block rounded-full"></span> TX (Upload)</span>
                    </div>
                    <SVGLineChart
                      data={statsHistory}
                      keys={['rx', 'tx']}
                      colors={['#3b82f6', '#ec4899']}
                      maxVal="auto"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setSelectedVPS(null)}
                className="btn btn-glass"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
