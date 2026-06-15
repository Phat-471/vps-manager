import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { 
  Bell, 
  Send, 
  Save, 
  ShieldAlert, 
  RefreshCw, 
  MessageSquare, 
  Sliders, 
  Check, 
  AlertTriangle,
  Zap,
  HeartPulse,
  Trash2
} from 'lucide-react';

export default function Alerts() {
  const { apiCall, showToast, currentVPS, isConnected, socket } = useVPS();
  const [loading, setLoading] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'history'

  // Global channels state
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState('');

  // VPS Specific thresholds state
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [downtimeAlert, setDowntimeAlert] = useState(false);
  const [autoHealing, setAutoHealing] = useState(false);
  const [cpuLimit, setCpuLimit] = useState(90);
  const [ramLimit, setRamLimit] = useState(90);
  const [diskLimit, setDiskLimit] = useState(90);

  // Alerts History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchConfig();
    }
  }, [isConnected, currentVPS]);

  useEffect(() => {
    if (isConnected && activeTab === 'history') {
      fetchHistory();
    }
  }, [isConnected, activeTab]);

  useEffect(() => {
    if (socket) {
      const handleAlertEvent = (event) => {
        setHistory(prev => {
          if (prev.some(item => item.id === event.id)) return prev;
          return [event, ...prev].slice(0, 200);
        });
        showToast(`Cảnh báo mới từ [${event.host}]: ${event.message}`, event.level === 'success' ? 'success' : 'warning');
      };
      
      socket.on('alert:event', handleAlertEvent);
      return () => {
        socket.off('alert:event', handleAlertEvent);
      };
    }
  }, [socket]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiCall('/api/alerts/history', 'POST');
      if (res.success) {
        setHistory(res.data || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải lịch sử cảnh báo: ' + err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký sự kiện cảnh báo và khôi phục?')) return;
    try {
      const res = await apiCall('/api/alerts/history/clear', 'POST');
      if (res.success) {
        showToast('Đã xóa lịch sử cảnh báo thành công', 'success');
        setHistory([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi xóa lịch sử: ' + err.message, 'error');
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/alerts/config/get', 'POST');
      if (res.success && res.data) {
        const { channels, thresholds } = res.data;
        
        // Load channels
        setTelegramEnabled(channels.telegram?.enabled || false);
        setTelegramToken(channels.telegram?.botToken || '');
        setTelegramChatId(channels.telegram?.chatId || '');
        setDiscordEnabled(channels.discord?.enabled || false);
        setDiscordWebhook(channels.discord?.webhookUrl || '');

        // Load thresholds for current VPS
        if (currentVPS && thresholds[currentVPS.id]) {
          const vpsThresh = thresholds[currentVPS.id];
          setMonitorEnabled(vpsThresh.enabled || false);
          setDowntimeAlert(vpsThresh.downtimeAlert || false);
          setCpuLimit(vpsThresh.cpuLimit || 90);
          setRamLimit(vpsThresh.ramLimit || 90);
          setDiskLimit(vpsThresh.diskLimit || 90);
          setAutoHealing(vpsThresh.autoHealing || false);
        } else {
          // Defaults if not configured yet
          setMonitorEnabled(false);
          setDowntimeAlert(true);
          setCpuLimit(90);
          setRamLimit(90);
          setDiskLimit(90);
          setAutoHealing(false);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải cấu hình cảnh báo: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChannels = async (e) => {
    e.preventDefault();
    setSavingChannels(true);
    try {
      await apiCall('/api/alerts/config/save-channels', 'POST', {
        telegram: {
          enabled: telegramEnabled,
          botToken: telegramToken,
          chatId: telegramChatId
        },
        discord: {
          enabled: discordEnabled,
          webhookUrl: discordWebhook
        }
      });
      showToast('Đã lưu cấu hình kênh thông báo thành công!', 'success');
      fetchConfig();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingChannels(false);
    }
  };

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    if (!currentVPS) return;
    setSavingThresholds(true);
    try {
      await apiCall('/api/alerts/config/save-threshold', 'POST', {
        enabled: monitorEnabled,
        cpuLimit,
        ramLimit,
        diskLimit,
        downtimeAlert,
        autoHealing
      });
      showToast('Đã cập nhật ngưỡng cảnh báo tài nguyên VPS thành công!', 'success');
      fetchConfig();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramToken || !telegramChatId) {
      showToast('Vui lòng điền Bot Token và Chat ID trước khi test', 'warning');
      return;
    }
    setTestingTelegram(true);
    try {
      await apiCall('/api/alerts/test/telegram', 'POST', {
        botToken: telegramToken,
        chatId: telegramChatId
      });
      showToast('Đã gửi tin nhắn test qua Telegram. Hãy kiểm tra điện thoại của bạn!', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestDiscord = async () => {
    if (!discordWebhook) {
      showToast('Vui lòng điền Discord Webhook URL trước khi test', 'warning');
      return;
    }
    setTestingDiscord(true);
    try {
      await apiCall('/api/alerts/test/discord', 'POST', {
        webhookUrl: discordWebhook
      });
      showToast('Đã gửi tin nhắn test qua Discord. Hãy kiểm tra kênh của bạn!', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setTestingDiscord(false);
    }
  };

  return (
    <div className="content-area">
      <Topbar title="GIÁM SÁT & CẢNH BÁO">
        <button className="btn btn-primary" onClick={fetchConfig} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </Topbar>

      <div className="explorer-header" style={{ marginBottom: '16px' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-outfit">
            <Bell size={24} className="text-indigo-400" />
            Giám sát & Cảnh báo VPS
          </h1>
          <p className="text-sm text-gray-400">
            Tự động theo dõi tải hệ thống (CPU, RAM, Disk) và tự động khôi phục (Auto-Healing) các dịch vụ bị lỗi.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="db-tabs-container" style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('config')}
          className={`db-tab-item ${activeTab === 'config' ? 'active' : ''}`}
        >
          Cấu hình Cảnh báo
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`db-tab-item ${activeTab === 'history' ? 'active' : ''}`}
        >
          Lịch sử Cảnh báo & Khôi phục
        </button>
      </div>

      {activeTab === 'config' && (
        loading ? (
          <div className="card-glass p-8 text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
            Đang tải cấu hình cảnh báo...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* CỘT 1: CẤU HỈNH KÊNH THÔNG BÁO (CHANNELS) */}
          <div className="space-y-6">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                <MessageSquare className="text-indigo-400" size={18} />
                Kênh nhận cảnh báo (Global Channels)
              </h2>
              <p className="text-xs text-gray-400">Định cấu hình các bot/webhook để chuyển tiếp thông báo sự kiện từ hệ thống.</p>
              
              <form onSubmit={handleSaveChannels} className="space-y-6">
                {/* Kênh Telegram */}
                <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-4">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="flex items-center gap-2 font-semibold text-gray-200 cursor-pointer text-sm">
                      <input 
                        type="checkbox" 
                        checked={telegramEnabled} 
                        onChange={e => setTelegramEnabled(e.target.checked)}
                        className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                      />
                      Gửi qua Telegram Bot
                    </label>
                    <button 
                      type="button"
                      onClick={handleTestTelegram}
                      disabled={testingTelegram || !telegramEnabled}
                      className="btn btn-glass btn-xs text-indigo-300"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      {testingTelegram ? 'Đang test...' : 'Gửi test'}
                    </button>
                  </div>
                  
                  {telegramEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="form-group">
                        <label className="text-xs text-gray-400">Telegram Bot Token</label>
                        <input
                          type="password"
                          required
                          placeholder="vd: 1234567890:ABCdefGhIJKlmNoPQRsT"
                          value={telegramToken}
                          onChange={e => setTelegramToken(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="text-xs text-gray-400">Telegram Chat ID (Người dùng hoặc Group ID)</label>
                        <input
                          type="text"
                          required
                          placeholder="vd: 987654321 hoặc -100123456789"
                          value={telegramChatId}
                          onChange={e => setTelegramChatId(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                        <span className="text-[10px] text-gray-500 leading-normal block mt-1">
                          Mẹo: Nhắn tin cho bot <code className="bg-white/5 px-1 py-0.5 rounded text-indigo-300">@userinfobot</code> để lấy Chat ID cá nhân của bạn, hoặc thêm bot vào nhóm và lấy ID của Group.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Kênh Discord */}
                <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-4">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="flex items-center gap-2 font-semibold text-gray-200 cursor-pointer text-sm">
                      <input 
                        type="checkbox" 
                        checked={discordEnabled} 
                        onChange={e => setDiscordEnabled(e.target.checked)}
                        className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                      />
                      Gửi qua Discord Webhook
                    </label>
                    <button 
                      type="button"
                      onClick={handleTestDiscord}
                      disabled={testingDiscord || !discordEnabled}
                      className="btn btn-glass btn-xs text-indigo-300"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      {testingDiscord ? 'Đang test...' : 'Gửi test'}
                    </button>
                  </div>
                  
                  {discordEnabled && (
                    <div className="space-y-3 pt-1">
                      <div className="form-group">
                        <label className="text-xs text-gray-400">Discord Webhook URL</label>
                        <input
                          type="password"
                          required
                          placeholder="https://discord.com/api/webhooks/..."
                          value={discordWebhook}
                          onChange={e => setDiscordWebhook(e.target.value)}
                          className="input-glass"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={savingChannels}
                  className="btn btn-primary btn-block flex items-center justify-center gap-2"
                  style={{ padding: '10px' }}
                >
                  <Save size={16} />
                  {savingChannels ? 'Đang lưu...' : 'Lưu cấu hình Kênh thông báo'}
                </button>
              </form>
            </div>
          </div>

          {/* CỘT 2: CẤU HÌNH NGƯỠNG CẢNH BÁO CHO VPS (THRESHOLDS) */}
          <div className="space-y-6">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                <Sliders className="text-green-400" size={18} />
                Giám sát VPS Hiện tại: <span className="text-indigo-400">{currentVPS?.name || currentVPS?.host}</span>
              </h2>
              <p className="text-xs text-gray-400">Định cấu hình các ngưỡng tài nguyên và cảnh báo downtime cho máy chủ này.</p>
              
              <form onSubmit={handleSaveThresholds} className="space-y-6">
                
                {/* Active Switcher */}
                <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-200 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={monitorEnabled} 
                      onChange={e => setMonitorEnabled(e.target.checked)}
                      className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                    />
                    Kích hoạt giám sát cảnh báo cho VPS này
                  </label>
                  <p className="text-[11px] text-gray-400 pl-6 leading-relaxed">
                    Khi bật, daemon chạy ngầm trên panel sẽ kết nối SSH định kỳ vào VPS này mỗi 5 phút để đo lường tài nguyên.
                  </p>
                </div>

                {monitorEnabled && (
                  <div className="space-y-5 pt-1">
                    
                    {/* Downtime alert check */}
                    <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-2">
                      <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={downtimeAlert} 
                          onChange={e => setDowntimeAlert(e.target.checked)}
                          className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                        />
                        Cảnh báo khi VPS Mất kết nối (Downtime Alert)
                      </label>
                      <p className="text-[10px] text-gray-400 pl-6 leading-normal">
                        Nhận thông báo khẩn cấp ngay lập tức nếu daemon không thể thực thi kết nối SSH tới VPS (giả lập máy chủ sập nguồn/tắt mạng).
                      </p>
                    </div>

                    {/* Auto-healing toggle */}
                    <div className="p-4 rounded-lg border space-y-2" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(5,150,105,0.04) 100%)', borderColor: 'rgba(16,185,129,0.15)' }}>
                      <label className="flex items-center gap-2.5 cursor-pointer" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          onClick={() => setAutoHealing(v => !v)}
                          style={{
                            position: 'relative',
                            width: '40px',
                            height: '22px',
                            borderRadius: '11px',
                            background: autoHealing ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,0.1)',
                            cursor: 'pointer',
                            transition: 'background 0.3s',
                            flexShrink: 0,
                            boxShadow: autoHealing ? '0 0 10px rgba(16,185,129,0.4)' : 'none'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: '3px',
                            left: autoHealing ? '21px' : '3px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'white',
                            transition: 'left 0.3s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: autoHealing ? '#34d399' : '#9ca3af' }}>
                          <Zap size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          Tự động Khôi phục Dịch vụ (Auto-Healing)
                        </span>
                      </label>
                      <p className="text-[10px] pl-0 leading-relaxed" style={{ color: '#6b7280' }}>
                        Daemon sẽ định kỳ kiểm tra trạng thái các dịch vụ <b style={{ color: '#9ca3af' }}>Nginx, MySQL, MariaDB, PHP-FPM, Docker</b> trên VPS. Nếu bất kỳ dịch vụ nào bị sập, hệ thống sẽ tự động thực thi lệnh <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 4px', borderRadius: '3px', color: '#6ee7b7' }}>systemctl start</code> để khôi phục và thông báo kết quả qua Telegram/Discord.
                      </p>
                      {autoHealing && (
                        <div className="flex items-start gap-2 mt-1 p-2 rounded" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
                          <Zap size={11} style={{ color: '#34d399', marginTop: '1px', flexShrink: 0 }} />
                          <span style={{ fontSize: '10px', color: '#6ee7b7', lineHeight: '1.5' }}>
                            <b>Đang bật:</b> Cooldown 1 giờ được áp dụng — hệ thống chỉ gửi tối đa 1 thông báo khôi phục thành công/thất bại mỗi giờ cho mỗi dịch vụ để tránh spam.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CPU Threshold */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-gray-300 font-semibold flex items-center gap-1">Ngưỡng quá tải CPU:</span>
                        <span className="text-indigo-300 font-mono font-bold">{cpuLimit}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="30" 
                        max="98" 
                        value={cpuLimit} 
                        onChange={e => setCpuLimit(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-[10px] text-gray-500 block leading-tight">Cảnh báo nếu CPU sử dụng liên tục vượt quá {cpuLimit}% khi quét.</span>
                    </div>

                    {/* RAM Threshold */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-gray-300 font-semibold flex items-center gap-1">Ngưỡng quá tải bộ nhớ RAM:</span>
                        <span className="text-indigo-300 font-mono font-bold">{ramLimit}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="30" 
                        max="98" 
                        value={ramLimit} 
                        onChange={e => setRamLimit(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-[10px] text-gray-500 block leading-tight">Cảnh báo nếu RAM bị chiếm dụng vượt quá {ramLimit}% dung lượng.</span>
                    </div>

                    {/* Disk Threshold */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-gray-300 font-semibold flex items-center gap-1">Ngưỡng cạn kiệt ổ cứng DISK:</span>
                        <span className="text-indigo-300 font-mono font-bold">{diskLimit}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="30" 
                        max="98" 
                        value={diskLimit} 
                        onChange={e => setDiskLimit(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <span className="text-[10px] text-gray-500 block leading-tight">Cảnh báo nếu dung lượng đĩa cứng phân vùng gốc `/` đầy quá {diskLimit}%.</span>
                    </div>

                    {/* Spam prevention tip */}
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex gap-2 items-start text-[10px] text-indigo-300 leading-relaxed font-normal">
                      <ShieldAlert size={14} className="shrink-0 text-indigo-400 mt-0.5" />
                      <span>
                        Hệ thống tự động tích hợp bộ lọc chống Spam: daemon sẽ chỉ gửi tối đa <b>1 thông báo mỗi 1 giờ</b> cho cùng một tài nguyên cảnh báo trên VPS này để tránh spam hộp thư của bạn.
                      </span>
                    </div>

                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={savingThresholds || !currentVPS}
                  className="btn btn-success btn-block flex items-center justify-center gap-2"
                  style={{ padding: '10px' }}
                >
                  <Save size={16} />
                  {savingThresholds ? 'Đang lưu...' : 'Lưu cấu hình Ngưỡng giám sát'}
                </button>

              </form>
            </div>
          </div>

        </div>
        )
      )}

      {activeTab === 'history' && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
              <ShieldAlert className="text-indigo-400" size={18} />
              Nhật ký Cảnh báo & Khôi phục (Auto-Healing)
            </h2>
            <button
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="btn btn-danger btn-sm flex items-center gap-1.5 border-none"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Trash2 size={12} /> Xóa nhật ký
            </button>
          </div>

          {historyLoading ? (
            <div className="text-center py-12 text-gray-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
              Đang tải lịch sử...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-500 italic">
              Không có bản ghi lịch sử cảnh báo hoặc khôi phục nào được ghi nhận.
            </div>
          ) : (
            <div className="space-y-3" style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
              {history.map((event) => {
                let BadgeColor = 'bg-white/5 text-gray-400 border-white/10';
                let Icon = AlertTriangle;
                let borderStyle = 'border-white/5';

                if (event.level === 'danger') {
                  BadgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
                  borderStyle = 'border-red-500/10';
                  if (event.type === 'downtime') {
                     Icon = ShieldAlert;
                  }
                } else if (event.level === 'warning') {
                  BadgeColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                  borderStyle = 'border-yellow-500/10';
                } else if (event.level === 'success') {
                  BadgeColor = 'bg-green-500/10 text-green-400 border-green-500/20';
                  borderStyle = 'border-green-500/10';
                  Icon = Zap;
                }

                return (
                  <div
                    key={event.id}
                    className={`p-4 bg-white/5 rounded-xl border ${borderStyle} flex items-start justify-between gap-4 hover:bg-white/10 transition-all`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-lg shrink-0 ${BadgeColor.split(' ')[0]} ${BadgeColor.split(' ')[1]}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-gray-300 font-mono">[{event.host}]</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${BadgeColor}`}>
                            {event.type.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">{event.message}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {new Date(event.timestamp).toLocaleString('vi-VN')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
