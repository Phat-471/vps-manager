import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  BarChart2, 
  Activity, 
  Users, 
  HardDrive, 
  AlertOctagon, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  UserCheck, 
  Globe 
} from 'lucide-react';

export default function TrafficStats() {
  const { apiCall, showToast, isConnected } = useVPS();
  const [loading, setLoading] = useState(false);
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLog, setSelectedLog] = useState('/var/log/nginx/access.log');
  const [stats, setStats] = useState(null);
  const [blockingIp, setBlockingIp] = useState(null);

  useEffect(() => {
    if (isConnected) {
      fetchLogFiles();
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && selectedLog) {
      fetchStats();
    }
  }, [selectedLog, isConnected]);

  const fetchLogFiles = async () => {
    try {
      const res = await apiCall('/api/stats/list-logs', 'POST');
      setLogFiles(res.data || []);
      if (res.data && res.data.length > 0 && !res.data.includes(selectedLog)) {
        setSelectedLog(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/stats/summary', 'POST', { logPath: selectedLog });
      setStats(res.data);
    } catch (err) {
      console.error(err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleBlockIP = async (ip) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chặn vĩnh viễn IP ${ip} thông qua tường lửa UFW?`)) return;
    setBlockingIp(ip);
    try {
      await apiCall('/api/security/blacklist/block', 'POST', { ip });
      showToast(`Đã chặn thành công IP ${ip} trên hệ thống!`, 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setBlockingIp(null);
    }
  };

  // Generate SVG Bar Chart dynamically
  const renderChart = (hourlyData) => {
    if (!hourlyData || hourlyData.length === 0) return null;
    const maxVal = Math.max(...hourlyData, 1);
    const chartHeight = 160;
    const barWidth = 24;
    const gap = 12;
    const paddingLeft = 40;
    const paddingBottom = 25;
    const chartWidth = paddingLeft + hourlyData.length * (barWidth + gap);

    return (
      <div className="w-full overflow-x-auto pt-4 pb-2 scrollbar-thin">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + paddingBottom}`} className="w-full h-44 font-mono text-[9px] fill-gray-400">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = chartHeight - ratio * chartHeight;
            const val = Math.round(ratio * maxVal);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <text x={paddingLeft - 10} y={y + 3} textAnchor="end" className="fill-gray-500">{val}</text>
              </g>
            );
          })}

          {/* Bars */}
          {hourlyData.map((val, hour) => {
            const height = (val / maxVal) * chartHeight;
            const x = paddingLeft + hour * (barWidth + gap);
            const y = chartHeight - height;
            return (
              <g key={hour} className="group cursor-pointer">
                {/* Hover Tooltip background */}
                <rect 
                  x={x - 4} 
                  y={y - 22} 
                  width={barWidth + 8} 
                  height={18} 
                  rx={4} 
                  fill="#6366f1" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                />
                {/* Hover Tooltip text */}
                <text 
                  x={x + barWidth / 2} 
                  y={y - 10} 
                  textAnchor="middle" 
                  className="fill-white font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[8px]"
                >
                  {val}
                </text>
                {/* Active Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(height, 2)}
                  rx={3}
                  className="fill-indigo-500/30 group-hover:fill-indigo-400 transition-all duration-150"
                  style={{
                    animationDelay: `${hour * 30}ms`
                  }}
                />
                {/* Glow Overlay on hover */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(height, 2)}
                  rx={3}
                  className="fill-indigo-500 opacity-0 group-hover:opacity-50 blur-[4px] transition-all duration-150 pointer-events-none"
                />
                {/* Hour text under bars */}
                <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" className="fill-gray-500">
                  {hour}h
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Thống kê Truy cập Web Server</h1>
          <p className="text-sm text-gray-400">Phân tích nhật ký hoạt động (access log) của Nginx để đo lường băng thông, lượt truy cập và theo dõi các IP bất thường.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Chọn File Log:</span>
            <select
              value={selectedLog}
              onChange={(e) => setSelectedLog(e.target.value)}
              className="input-glass"
              style={{ padding: '6px 10px', fontSize: '13px', minWidth: '220px' }}
            >
              {logFiles.length === 0 ? (
                <option value="/var/log/nginx/access.log">/var/log/nginx/access.log</option>
              ) : (
                logFiles.map(file => (
                  <option key={file} value={file}>{file}</option>
                ))
              )}
            </select>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="btn btn-glass flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {loading && (
        <div className="card-glass p-8 text-center text-gray-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang quét dữ liệu log trên VPS... (Có thể mất vài giây)
        </div>
      )}

      {!loading && !stats && (
        <div className="card-glass p-6 text-center text-gray-400 border border-yellow-500/20 bg-yellow-500/5">
          <AlertOctagon size={32} className="mx-auto mb-2 text-yellow-500" />
          <p className="font-semibold text-gray-200">Không tìm thấy hoặc không thể đọc tệp log</p>
          <p className="text-xs mt-1">Đảm bảo Nginx đã được cài đặt, đang chạy và đã ghi nhận lượt truy cập vào website của bạn.</p>
        </div>
      )}

      {!loading && stats && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card-glass p-5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Tổng số Requests</span>
                <strong className="text-2xl font-bold font-outfit text-white">{stats.totalRequests.toLocaleString()}</strong>
              </div>
              <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Activity size={20} />
              </div>
            </div>

            <div className="card-glass p-5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Unique Visitors (IPs)</span>
                <strong className="text-2xl font-bold font-outfit text-white">{stats.uniqueVisitors.toLocaleString()}</strong>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Users size={20} />
              </div>
            </div>

            <div className="card-glass p-5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Tổng băng thông</span>
                <strong className="text-2xl font-bold font-outfit text-white">{formatBytes(stats.totalBandwidthBytes)}</strong>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                <HardDrive size={20} />
              </div>
            </div>

            <div className="card-glass p-5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">Tỷ lệ lỗi HTTP</span>
                <strong className={`text-2xl font-bold font-outfit ${parseFloat(stats.errorRate) > 5 ? 'text-red-400' : 'text-white'}`}>
                  {stats.errorRate}%
                </strong>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertOctagon size={20} />
              </div>
            </div>
          </div>

          {/* SVG Chart Card */}
          <div className="card-glass p-6 rounded-xl space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart2 size={18} className="text-indigo-400" />
              Lượng Request theo khung giờ (24 giờ gần nhất)
            </h2>
            <p className="text-xs text-gray-400">Biểu thị sự phân bổ các truy cập HTTP theo từng giờ để theo dõi các mốc tải đỉnh điểm.</p>
            {renderChart(stats.hourlyRequests)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Top Visited Pages */}
            <div className="card-glass p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
                <Globe size={16} /> Top 10 URL truy cập nhiều nhất
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 pb-2 text-gray-400 font-mono">
                      <th className="pb-2">Đường dẫn (URL)</th>
                      <th className="pb-2 text-right" style={{ width: '80px' }}>Số Requests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.topPaths.length === 0 ? (
                      <tr>
                        <td colSpan="2" className="py-4 text-center text-gray-500">Không có dữ liệu</td>
                      </tr>
                    ) : (
                      stats.topPaths.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="py-2.5 font-mono text-gray-300 truncate max-w-[280px]" title={item.path}>
                            {item.path}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-gray-200">{item.count.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Visitors with Block IP */}
            <div className="card-glass p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-red-300">
                <ShieldAlert size={16} /> Top 10 Địa chỉ IP truy cập nhiều nhất
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 pb-2 text-gray-400 font-mono">
                      <th className="pb-2">Địa chỉ IP</th>
                      <th className="pb-2 text-center" style={{ width: '80px' }}>Requests</th>
                      <th className="pb-2 text-right" style={{ width: '90px' }}>Tường lửa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.topIPs.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="py-4 text-center text-gray-500">Không có dữ liệu</td>
                      </tr>
                    ) : (
                      stats.topIPs.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="py-2.5 font-mono text-gray-300">{item.ip}</td>
                          <td className="py-2.5 text-center font-semibold text-gray-200">{item.count.toLocaleString()}</td>
                          <td className="py-2.5 text-right">
                            <button
                              disabled={blockingIp === item.ip}
                              onClick={() => handleBlockIP(item.ip)}
                              className="btn btn-glass btn-xs text-red-400 flex items-center gap-1 ml-auto"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                            >
                              <ShieldAlert size={10} />
                              {blockingIp === item.ip ? 'Chặn...' : 'Chặn IP'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* HTTP Status codes & User agents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Status Codes */}
            <div className="card-glass p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-green-300">
                <ShieldCheck size={16} /> Phân bố mã trạng thái HTTP Response
              </h3>
              <div className="space-y-3 pt-2">
                {Object.entries(stats.statusCodes).map(([code, count]) => {
                  const percentage = stats.totalRequests > 0 ? ((count / stats.totalRequests) * 100).toFixed(1) : 0;
                  let colorClass = 'bg-indigo-500';
                  if (code === '3xx') colorClass = 'bg-blue-500';
                  else if (code === '4xx') colorClass = 'bg-amber-500';
                  else if (code === '5xx') colorClass = 'bg-red-500';

                  return (
                    <div key={code} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-gray-300">{code} Success/Redirect</span>
                        <span className="text-gray-400 font-semibold">{count.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full ${colorClass} rounded-full`} 
                          style={{ width: `${percentage}%`, transition: 'width 0.5s ease' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Browsers and Bots */}
            <div className="card-glass p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-blue-300">
                <UserCheck size={16} /> Thiết bị truy cập & Crawler Bots
              </h3>
              <div className="space-y-3 pt-1 text-xs">
                {stats.topUserAgents.slice(0, 5).map((item, idx) => {
                  const percentage = stats.totalRequests > 0 ? ((item.count / stats.totalRequests) * 100).toFixed(1) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between font-mono" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-gray-300 truncate max-w-[200px]" title={item.ua}>{item.ua}</span>
                        <span className="text-gray-400 font-semibold">{item.count.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-indigo-400 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
