import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { 
  Mail, 
  RotateCw, 
  Check, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  Info, 
  Globe, 
  Key, 
  Copy,
  Server,
  BookOpen,
  Save
} from 'lucide-react';

export default function MailConfig() {
  const { apiCall, showToast, isConnected, currentVPS } = useVPS();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    installed: false,
    postfixStatus: 'not-installed',
    dovecotStatus: 'not-installed',
    configuredDomain: ''
  });

  // Tab control
  const [activeTab, setActiveTab] = useState('mailboxes'); // 'mailboxes' | 'dns' | 'instructions'

  // Wizard state
  const [setupDomain, setSetupDomain] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [installing, setInstalling] = useState(false);

  // Mailboxes list state
  const [mailboxes, setMailboxes] = useState([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMailUser, setNewMailUser] = useState('');
  const [newMailPass, setNewMailPass] = useState('');
  const [creatingMailbox, setCreatingMailbox] = useState(false);

  // DNS records state
  const [dnsData, setDnsData] = useState(null);
  const [dnsLoading, setDnsLoading] = useState(false);

  // SMTP Relay state
  const [relayHost, setRelayHost] = useState('');
  const [relayPort, setRelayPort] = useState('587');
  const [relayUser, setRelayUser] = useState('');
  const [relayPass, setRelayPass] = useState('');
  const [relayLoading, setRelayLoading] = useState(false);
  const [savingRelay, setSavingRelay] = useState(false);

  useEffect(() => {
    if (isConnected) {
      checkStatus();
    }
  }, [isConnected, currentVPS]);

  // Load tab-specific data
  useEffect(() => {
    if (isConnected && status.installed) {
      if (activeTab === 'mailboxes') {
        loadMailboxes();
      } else if (activeTab === 'dns') {
        loadDNSInstructions();
      } else if (activeTab === 'relay') {
        loadRelayConfig();
      }
    }
  }, [activeTab, isConnected, status.installed]);

  const loadRelayConfig = async () => {
    setRelayLoading(true);
    try {
      const res = await apiCall('/api/mail/relay/get', 'POST');
      if (res.success && res.data) {
        let host = res.data.relayHost || '';
        let port = '587';
        if (host.includes('[')) {
          const match = host.match(/\[(.*)\]:(\d+)/);
          if (match) {
            host = match[1];
            port = match[2];
          }
        }
        setRelayHost(host);
        setRelayPort(port);
        setRelayUser(res.data.relayUser || '');
      }
    } catch (err) {
      showToast('Lỗi tải cấu hình SMTP Relay: ' + err.message, 'error');
    } finally {
      setRelayLoading(false);
    }
  };

  const handleSaveRelay = async (e) => {
    e.preventDefault();
    setSavingRelay(true);
    try {
      const res = await apiCall('/api/mail/relay/save', 'POST', {
        relayHost: relayHost.trim(),
        relayPort: parseInt(relayPort),
        relayUser: relayUser.trim(),
        relayPass: relayPass.trim()
      });
      if (res.success) {
        showToast(res.message, 'success');
        setRelayPass('');
      }
    } catch (err) {
      showToast('Lỗi lưu cấu hình SMTP Relay: ' + err.message, 'error');
    } finally {
      setSavingRelay(false);
    }
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/mail/status', 'POST');
      if (res.success && res.data) {
        setStatus(res.data);
        if (res.data.installed) {
          // Default setup email field fallback
          setSetupDomain(res.data.configuredDomain || '');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi kiểm tra trạng thái Mail Server: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMailboxes = async () => {
    setMailboxesLoading(true);
    try {
      const res = await apiCall('/api/mail/mailbox/list', 'POST');
      if (res.success) {
        setMailboxes(res.data || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải danh sách hòm thư: ' + err.message, 'error');
    } finally {
      setMailboxesLoading(false);
    }
  };

  const loadDNSInstructions = async () => {
    if (!status.configuredDomain) return;
    setDnsLoading(true);
    try {
      const res = await apiCall('/api/mail/dns-instructions', 'POST', {
        domain: status.configuredDomain
      });
      if (res.success) {
        setDnsData(res.data);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải cấu hình DNS: ' + err.message, 'error');
    } finally {
      setDnsLoading(false);
    }
  };

  const handleInstallMailServer = async (e) => {
    e.preventDefault();
    if (!setupDomain.trim()) return;

    if (!window.confirm(`Bạn có chắc chắn muốn tự động cài đặt và cấu hình Mail Server cho tên miền "${setupDomain}"?`)) return;

    setInstalling(true);
    showToast('Đang cài đặt Postfix, Dovecot và thiết lập bảo mật SMTP/IMAP...', 'info');
    try {
      const res = await apiCall('/api/mail/install', 'POST', {
        domain: setupDomain.trim(),
        email: setupEmail.trim()
      });
      if (res.success) {
        showToast(res.message, 'success');
        await checkStatus();
        setActiveTab('mailboxes');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstalling(false);
    }
  };

  const handleCreateMailbox = async (e) => {
    e.preventDefault();
    if (!newMailUser.trim() || !newMailPass.trim()) return;

    setCreatingMailbox(true);
    try {
      const res = await apiCall('/api/mail/mailbox/create', 'POST', {
        username: newMailUser.trim(),
        password: newMailPass.trim(),
        domain: status.configuredDomain
      });
      if (res.success) {
        showToast(res.message, 'success');
        setNewMailUser('');
        setNewMailPass('');
        setShowCreateForm(false);
        await loadMailboxes();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingMailbox(false);
    }
  };

  const handleDeleteMailbox = async (username) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn hòm thư "${username}@${status.configuredDomain}"? Toàn bộ thư trong hộp thư này sẽ bị mất.`)) return;

    try {
      const res = await apiCall('/api/mail/mailbox/delete', 'POST', { username });
      if (res.success) {
        showToast(res.message, 'success');
        await loadMailboxes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text, name) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${name} vào bộ nhớ tạm!`, 'success');
  };

  const handleRefresh = async () => {
    await checkStatus();
    if (status.installed) {
      if (activeTab === 'mailboxes') await loadMailboxes();
      if (activeTab === 'dns') await loadDNSInstructions();
    }
  };

  return (
    <div className="content-area">
      <Topbar title="QUẢN LÝ MAIL SERVER">
        <button className="btn btn-primary" onClick={handleRefresh} disabled={loading || mailboxesLoading}>
          <RotateCw size={14} className={(loading || mailboxesLoading) ? 'animate-spin' : ''} /> Làm mới
        </button>
      </Topbar>

      <div className="explorer-header" style={{ marginBottom: '16px' }}>
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-outfit">
            <Mail size={24} className="text-indigo-400" />
            Cấu hình Mail Server (SMTP/IMAP)
          </h1>
          <p className="text-sm text-gray-400">
            Tự động triển khai dịch vụ gửi nhận email (Postfix + Dovecot) theo tên miền riêng, tạo hộp thư và hướng dẫn bản ghi DNS.
          </p>
        </div>
      </div>

      {loading && !status.installed ? (
        <div className="card-glass p-8 text-center text-gray-400">
          <RotateCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang truy vấn cấu hình Mail Server trên VPS...
        </div>
      ) : !status.installed ? (
        /* SETUP WIZARD FOR NEW MAIL SERVER */
        <div className="space-y-6">
          <div className="db-warning-card">
            <AlertTriangle className="db-warning-icon text-yellow-500" size={24} />
            <div className="db-warning-text">
              <strong className="db-warning-title text-yellow-400" style={{ fontSize: '14px' }}>
                Chưa cài đặt Mail Server trên VPS này!
              </strong>
              <p className="text-gray-400" style={{ marginTop: '4px' }}>
                Hệ thống hỗ trợ cấu hình tự động Postfix (gửi thư SMTP) và Dovecot (nhận thư IMAP/POP3) trực tiếp theo tên miền của bạn.
              </p>
            </div>
          </div>

          <div className="card-glass p-8 rounded-xl max-w-xl mx-auto space-y-6" style={{ marginTop: '20px' }}>
            <div className="p-4 bg-indigo-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-indigo-400">
              <Mail size={32} />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-bold text-gray-200">Trình Cài đặt Mail Server 1-Click</h2>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                Vui lòng nhập tên miền chính bạn muốn sử dụng để gửi nhận thư (ví dụ: `cua-ban.com`). Hệ thống sẽ tạo phân vùng mail sub-domain `mail.cua-ban.com` và cấu hình bảo mật SASL.
              </p>
            </div>

            <form onSubmit={handleInstallMailServer} className="space-y-4 max-w-md mx-auto">
              <div className="form-group">
                <label className="text-xs text-gray-400 block mb-1">Tên miền chính (Domain):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: cua-ban.com"
                  value={setupDomain}
                  onChange={e => setSetupDomain(e.target.value)}
                  className="input-glass"
                  style={{ padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div className="form-group">
                <label className="text-xs text-gray-400 block mb-1">Email quản trị liên hệ (không bắt buộc):</label>
                <input
                  type="email"
                  placeholder="Ví dụ: admin@cua-ban.com"
                  value={setupEmail}
                  onChange={e => setSetupEmail(e.target.value)}
                  className="input-glass"
                  style={{ padding: '10px', fontSize: '13px' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={installing || !setupDomain}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 font-semibold"
              >
                <Server size={18} />
                {installing ? 'Đang cài đặt Mail Server...' : 'Bắt đầu Thiết lập & Cài đặt'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* INSTALLED INTERFACE */
        <div className="space-y-6">
          {/* Tabs header */}
          <div className="flex border-b border-white/10 mb-6 gap-2" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('mailboxes')}
              className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
                activeTab === 'mailboxes' 
                  ? 'text-indigo-400 border-b-2 border-indigo-500' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Danh sách Hòm thư ({mailboxes.length})
            </button>
            <button 
              onClick={() => setActiveTab('dns')}
              className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
                activeTab === 'dns' 
                  ? 'text-indigo-400 border-b-2 border-indigo-500' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Cấu hình DNS (MX/SPF/DKIM)
            </button>
            <button 
              onClick={() => setActiveTab('relay')}
              className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
                activeTab === 'relay' 
                  ? 'text-indigo-400 border-b-2 border-indigo-500' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Cấu hình SMTP Relay
            </button>
            <button 
              onClick={() => setActiveTab('instructions')}
              className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
                activeTab === 'instructions' 
                  ? 'text-indigo-400 border-b-2 border-indigo-500' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Hướng dẫn Kết nối Khách
            </button>
          </div>

          {/* TAB 1: MAILBOXES MANAGEMENT */}
          {activeTab === 'mailboxes' && (
            <div className="db-layout-container">
              {/* Main lists */}
              <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
                <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                    <Mail className="text-indigo-400" size={18} />
                    Danh sách hộp thư theo tên miền: <span className="text-indigo-300 font-mono">@{status.configuredDomain}</span>
                  </h2>
                  {!showCreateForm && (
                    <button 
                      onClick={() => setShowCreateForm(true)}
                      className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1 font-semibold"
                    >
                      <Plus size={14} /> Tạo hòm thư
                    </button>
                  )}
                </div>

                {mailboxesLoading ? (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    <RotateCw size={18} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Đang tải danh sách tài khoản email...
                  </div>
                ) : mailboxes.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-xs font-normal">
                    Chưa có hòm thư nào được tạo. Vui lòng bấm vào nút "Tạo hòm thư" để cấp phát tài khoản email đầu tiên.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 pb-2 text-gray-400 font-mono uppercase text-[10px] tracking-wider bg-white/[0.02]">
                          <th className="p-3">Địa chỉ Email</th>
                          <th className="p-3">Tài khoản hệ thống</th>
                          <th className="p-3">Dung lượng sử dụng</th>
                          <th className="p-3">Ngày tạo</th>
                          <th className="p-3 text-right" style={{ width: '80px' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {mailboxes.map(mb => (
                          <tr key={mb.username} className="hover:bg-white/[0.01]">
                            <td className="p-3 font-semibold text-gray-200 text-sm">{mb.email}</td>
                            <td className="p-3 font-mono text-gray-400">{mb.username}</td>
                            <td className="p-3 text-gray-300">{mb.size}</td>
                            <td className="p-3 text-gray-300">{mb.createdAt}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteMailbox(mb.username)}
                                className="btn btn-glass btn-xs text-red-400 hover:text-red-300"
                                style={{ padding: '6px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sidebar: Create box form */}
              {showCreateForm && (
                <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-bold text-gray-200 flex items-center gap-1.5 text-sm">
                      <Plus className="text-green-400" size={16} />
                      Tạo tài khoản Email mới
                    </h3>
                    <button 
                      onClick={() => setShowCreateForm(false)} 
                      className="text-gray-400 hover:text-white text-xs border border-white/10 px-1.5 py-0.5 rounded"
                    >
                      Đóng
                    </button>
                  </div>

                  <form onSubmit={handleCreateMailbox} className="space-y-4">
                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Tài khoản hòm thư:</label>
                      <div className="flex items-center gap-1" style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          required
                          placeholder="ví dụ: contact, support"
                          value={newMailUser}
                          onChange={e => setNewMailUser(e.target.value)}
                          className="input-glass flex-grow"
                          style={{ padding: '8px', fontSize: '12px' }}
                        />
                        <span className="text-xs text-gray-400 font-mono font-semibold select-none">
                          @{status.configuredDomain}
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="text-xs text-gray-400 block mb-1">Mật khẩu:</label>
                      <input
                        type="password"
                        required
                        placeholder="Mật khẩu hòm thư"
                        value={newMailPass}
                        onChange={e => setNewMailPass(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px', fontSize: '12px' }}
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={creatingMailbox}
                      className="btn btn-success btn-block py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Check size={14} />
                      {creatingMailbox ? 'Đang tạo...' : 'Tạo hòm thư'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DNS RECORDS CONFIG */}
          {activeTab === 'dns' && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
                <Info className="text-indigo-400 mt-0.5 flex-shrink-0" size={18} />
                <div className="text-xs text-gray-300 leading-relaxed">
                  <strong className="text-indigo-300 block mb-1">Cần thiết lập bản ghi DNS:</strong>
                  Để gửi email không bị vào hộp thư rác (Spam) và có thể nhận được mail phản hồi, bạn **bắt buộc** phải truy cập trình quản lý DNS của tên miền (Cloudflare, Tenten, PA...) và tạo đầy đủ 4 bản ghi bên dưới.
                </div>
              </div>

              {dnsLoading ? (
                <div className="card-glass p-8 text-center text-gray-400">
                  <RotateCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  Đang quét và lấy các khóa bản ghi DNS từ máy chủ...
                </div>
              ) : dnsData ? (
                <div className="card-glass p-6 rounded-xl space-y-4">
                  <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                    <Globe className="text-indigo-400" size={18} />
                    Các bản ghi DNS cần tạo cấu hình
                  </h2>

                  <div className="space-y-4">
                    {/* Record 1: A Record */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3 hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">A Record</span>
                          <span className="font-mono text-gray-200 text-xs font-bold">mail.{dnsData.domain}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal">Trỏ domain phụ mail về VPS</span>
                      </div>
                      <div className="flex items-center justify-between bg-black/30 p-2.5 rounded font-mono text-xs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-indigo-300">{dnsData.ip}</span>
                        <button 
                          onClick={() => copyToClipboard(dnsData.ip, 'IP')} 
                          className="text-gray-400 hover:text-white"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Record 2: MX Record */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3 hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">MX Record</span>
                          <span className="font-mono text-gray-200 text-xs font-bold">@ (Tên miền chính)</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal">Độ ưu tiên: 10 (Priority: 10)</span>
                      </div>
                      <div className="flex items-center justify-between bg-black/30 p-2.5 rounded font-mono text-xs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-indigo-300">mail.{dnsData.domain}</span>
                        <button 
                          onClick={() => copyToClipboard(`mail.${dnsData.domain}`, 'MX Hostname')} 
                          className="text-gray-400 hover:text-white"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Record 3: SPF Record */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3 hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">TXT (SPF)</span>
                          <span className="font-mono text-gray-200 text-xs font-bold">@ (Tên miền chính)</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal">Xác thực máy chủ gửi thư tin cậy</span>
                      </div>
                      <div className="flex items-center justify-between bg-black/30 p-2.5 rounded font-mono text-xs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-indigo-300">{dnsData.spfRecord}</span>
                        <button 
                          onClick={() => copyToClipboard(dnsData.spfRecord, 'SPF Record')} 
                          className="text-gray-400 hover:text-white"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Record 4: DKIM Record */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3 hover:bg-white/10 transition-all">
                      <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">TXT (DKIM)</span>
                          <span className="font-mono text-gray-200 text-xs font-bold">default._domainkey</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal">Ký số điện tử chống giả mạo email</span>
                      </div>
                      {dnsData.dkimRecord === 'none' ? (
                        <p className="text-xs text-red-400 bg-red-400/5 p-2 rounded">Chưa cấu hình hoặc chưa lấy được khóa DKIM từ server.</p>
                      ) : (
                        <div className="flex items-start justify-between bg-black/30 p-2.5 rounded font-mono text-[10px]" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-indigo-300 break-all pr-4">{dnsData.dkimRecord}</span>
                          <button 
                            onClick={() => copyToClipboard(dnsData.dkimRecord, 'DKIM Record')} 
                            className="text-gray-400 hover:text-white shrink-0"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">Không tìm thấy thông tin cấu hình DNS.</p>
              )}
            </div>
          )}

          {/* TAB 3: CLIENT CONFIGURATION INSTRUCTIONS */}
          {activeTab === 'instructions' && (
            <div className="card-glass p-6 rounded-xl space-y-6">
              <h2 className="text-base font-bold text-gray-200 flex items-center gap-2">
                <BookOpen className="text-indigo-400" size={18} />
                Hướng dẫn cấu hình kết nối Client (Outlook/Gmail/Mail App)
              </h2>
              
              <p className="text-xs text-gray-400 leading-normal">
                Sử dụng các thông số bên dưới để đăng nhập tài khoản hộp thư đã tạo trên các ứng dụng đọc email của máy tính và điện thoại.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* SMTP Server */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-1.5">
                    <Server size={16} />
                    Máy chủ gửi thư (Outgoing SMTP)
                  </h3>
                  <div className="space-y-2 text-xs text-gray-300 font-mono">
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Server Host:</span>
                      <strong>mail.{status.configuredDomain}</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Cổng SMTP (STARTTLS):</span>
                      <strong>587 (Khuyên dùng)</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Cổng SMTP (SSL/TLS):</span>
                      <strong>465</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Cổng SMTP (Không mã hóa):</span>
                      <strong>25</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Phương thức xác thực:</span>
                      <strong>PLAIN / LOGIN</strong>
                    </div>
                  </div>
                </div>

                {/* IMAP/POP3 Server */}
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <h3 className="font-bold text-sm text-green-300 flex items-center gap-1.5">
                    <Key size={16} />
                    Máy chủ nhận thư (Incoming IMAP/POP3)
                  </h3>
                  <div className="space-y-2 text-xs text-gray-300 font-mono">
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Server Host:</span>
                      <strong>mail.{status.configuredDomain}</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Cổng IMAP (STARTTLS):</span>
                      <strong>143 (Khuyên dùng)</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Cổng IMAP (SSL/TLS):</span>
                      <strong>993</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Cổng POP3 (SSL/TLS):</span>
                      <strong>995</strong>
                    </div>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-gray-400">Tài khoản (Username):</span>
                      <strong>[Tên tài khoản hệ thống]</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SMTP RELAY CONFIG */}
          {activeTab === 'relay' && (
            <div className="card-glass p-6 rounded-xl space-y-4 max-w-xl mx-auto">
              <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Server size={18} className="text-indigo-400" />
                  Cấu hình Postfix SMTP Relay
                </h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                SMTP Relay giúp chuyển tiếp các email gửi ra ngoài qua các nhà cung cấp như SendGrid, Mailgun, Amazon SES,... giúp gia tăng tỷ lệ vào inbox và giải quyết lỗi chặn Port 25 trên nhiều VPS.
              </p>

              {relayLoading ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <RotateCw size={18} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  Đang tải cấu hình SMTP Relay...
                </div>
              ) : (
                <form onSubmit={handleSaveRelay} className="space-y-4">
                  <div className="form-group">
                    <label className="text-xs text-gray-400">SMTP Server Host</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: smtp.sendgrid.net hoặc smtp.mailgun.org"
                      value={relayHost}
                      onChange={e => setRelayHost(e.target.value)}
                      className="input-glass"
                      style={{ padding: '8px', fontSize: '12px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-xs text-gray-400">SMTP Port</label>
                    <input
                      type="number"
                      required
                      placeholder="vd: 587, 465, 2525"
                      value={relayPort}
                      onChange={e => setRelayPort(e.target.value)}
                      className="input-glass"
                      style={{ padding: '8px', fontSize: '12px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-xs text-gray-400">SMTP Username</label>
                    <input
                      type="text"
                      placeholder="Tên tài khoản SMTP"
                      value={relayUser}
                      onChange={e => setRelayUser(e.target.value)}
                      className="input-glass"
                      style={{ padding: '8px', fontSize: '12px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-xs text-gray-400">SMTP Password / API Key</label>
                    <input
                      type="password"
                      placeholder="Mật khẩu hoặc API Key mới (để trống nếu giữ nguyên)"
                      value={relayPass}
                      onChange={e => setRelayPass(e.target.value)}
                      className="input-glass"
                      style={{ padding: '8px', fontSize: '12px' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={savingRelay}
                    className="btn btn-primary btn-block flex items-center justify-center gap-2"
                    style={{ padding: '10px' }}
                  >
                    <Save size={16} />
                    {savingRelay ? 'Đang lưu cấu hình...' : 'Lưu cấu hình & Áp dụng Relay'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
