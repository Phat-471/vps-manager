import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Shield, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Power, 
  RefreshCw, 
  Server, 
  AlertTriangle, 
  Key, 
  Globe, 
  Activity, 
  Lock 
} from 'lucide-react';

export default function Security() {
  const { apiCall, showToast, currentVPS } = useVPS();
  const [activeTab, setActiveTab] = useState('firewall');
  const [loading, setLoading] = useState(false);

  // Tab 1: Firewall UFW & Fail2Ban State
  const [ufwActive, setUfwActive] = useState(false);
  const [ufwRules, setUfwRules] = useState([]);
  const [fail2banActive, setFail2banActive] = useState(false);
  const [portInput, setPortInput] = useState('');
  const [protoInput, setProtoInput] = useState('tcp');

  // Tab 2: Listening Ports State
  const [listeningPorts, setListeningPorts] = useState([]);
  const [portsLoading, setPortsLoading] = useState(false);

  // Tab 3: SSH Port State
  const [sshPortInput, setSshPortInput] = useState('');
  const [sshLoading, setSshLoading] = useState(false);

  // Tab 4: SSL Panel State
  const [sslDomain, setSslDomain] = useState('');
  const [sslEmail, setSslEmail] = useState('');
  const [sslLoading, setSslLoading] = useState(false);
  const [sslResult, setSslResult] = useState(null);

  useEffect(() => {
    if (activeTab === 'firewall') {
      fetchSecurityStatus();
    } else if (activeTab === 'ports') {
      fetchListeningPorts();
    }
  }, [activeTab]);

  const fetchSecurityStatus = async () => {
    setLoading(true);
    try {
      const ufwRes = await apiCall('/api/security/ufw/status', 'POST');
      setUfwActive(ufwRes.data?.active || false);
      setUfwRules(ufwRes.data?.rules || []);

      const f2bRes = await apiCall('/api/security/fail2ban/status', 'POST');
      setFail2banActive(f2bRes.data?.active || false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUFW = async () => {
    const action = ufwActive ? 'disable' : 'enable';
    if (action === 'enable' && !window.confirm('Kích hoạt UFW sẽ tự động mở port 22/tcp (SSH). Tiếp tục?')) return;
    try {
      showToast(`Đang thực hiện ${action === 'enable' ? 'kích hoạt' : 'vô hiệu hóa'} UFW...`, 'info');
      await apiCall(`/api/security/ufw/${action}`, 'POST');
      showToast(`Đã ${action === 'enable' ? 'bật' : 'tắt'} Tường lửa UFW`, 'success');
      fetchSecurityStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!portInput.trim()) return;
    try {
      await apiCall('/api/security/ufw/add', 'POST', {
        port: portInput,
        proto: protoInput
      });
      showToast(`Đã tạo luật mở port ${portInput}/${protoInput}`, 'success');
      setPortInput('');
      fetchSecurityStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (index) => {
    if (!window.confirm(`Bạn có chắc muốn xóa luật số #${index}?`)) return;
    try {
      await apiCall('/api/security/ufw/delete', 'POST', { index });
      showToast(`Đã xóa luật UFW thành công`, 'success');
      fetchSecurityStatus();
    } catch (err) {
      console.error(err);
    }
  };

  // Tab 2: Listening Ports Method
  const fetchListeningPorts = async () => {
    setPortsLoading(true);
    try {
      const res = await apiCall('/api/security/ports/listening', 'POST');
      if (res.success) {
        setListeningPorts(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPortsLoading(false);
    }
  };

  // Tab 3: Change SSH Port Method
  const handleChangeSSHPort = async (e) => {
    e.preventDefault();
    if (!sshPortInput.trim()) return;
    const port = parseInt(sshPortInput);
    if (!port || port < 1 || port > 65535) {
      showToast('Cổng SSH không hợp lệ (1-65535)', 'warning');
      return;
    }

    const confirmMsg = `CẢNH BÁO QUAN TRỌNG:\n\n` +
      `1. Hệ thống sẽ tự động thêm luật mở cổng ${port}/tcp vào tường lửa UFW trước để tránh bị khóa.\n` +
      `2. File cấu hình SSH sẽ được sửa đổi và khởi động lại dịch vụ SSH daemon.\n` +
      `3. Sau khi đổi, các kết nối SSH hiện tại có thể bị ngắt. Bạn PHẢI đổi Cổng kết nối trong mục 'Đổi VPS' trên Panel từ 22 thành ${port} để kết nối lại.\n\n` +
      `Bạn có chắc chắn muốn đổi cổng SSH sang ${port}?`;

    if (!window.confirm(confirmMsg)) return;

    setSshLoading(true);
    try {
      const res = await apiCall('/api/security/ssh/port', 'POST', { newPort: sshPortInput });
      if (res.success) {
        showToast(res.message, 'success');
        setSshPortInput('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSshLoading(false);
    }
  };

  // Tab 4: Configure Panel SSL Method
  const handleConfigurePanelSSL = async (e) => {
    e.preventDefault();
    if (!sslDomain.trim() || !sslEmail.trim()) return;

    const confirmMsg = `Bạn có chắc chắn muốn cấu hình Domain & SSL cho Panel?\n\n` +
      `LƯU Ý: Tên miền '${sslDomain}' phải được trỏ (DNS A Record) về IP của VPS này trước khi cấu hình. Nếu không trỏ, quá trình cài SSL Let's Encrypt sẽ thất bại.`;

    if (!window.confirm(confirmMsg)) return;

    setSslLoading(true);
    setSslResult(null);
    try {
      showToast('Đang cài đặt Nginx, Certbot và cấp phát chứng chỉ SSL...', 'info');
      const res = await apiCall('/api/security/panel/ssl', 'POST', {
        domain: sslDomain,
        email: sslEmail
      });
      if (res.success) {
        showToast('Cấu hình HTTPS cho Panel thành công!', 'success');
        setSslResult(res.data);
        setSslDomain('');
        setSslEmail('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSslLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight font-outfit">Bảo mật hệ thống</h1>
          <p className="text-sm text-gray-400">Giám sát tường lửa, kiểm tra cổng mạng đang lắng nghe, bảo mật SSH và SSL cho Panel</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="db-tabs-container card-glass p-1.5 flex gap-2 rounded-xl">
        <button 
          onClick={() => setActiveTab('firewall')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'firewall' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Shield size={16} />
          Tường lửa & Dịch vụ
        </button>
        <button 
          onClick={() => setActiveTab('ports')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'ports' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Activity size={16} />
          Cổng kết nối (Listening Ports)
        </button>
        <button 
          onClick={() => setActiveTab('ssh')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'ssh' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Key size={16} />
          Bảo mật SSH
        </button>
        <button 
          onClick={() => setActiveTab('ssl')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'ssl' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Globe size={16} />
          SSL Panel (HTTPS)
        </button>
      </div>

      {/* TAB 1: Firewall UFW & Fail2Ban */}
      {activeTab === 'firewall' && (
        <div className="space-y-6">
          <div className="grid-2">
            {/* UFW Panel */}
            <div className="card-glass p-6 rounded-xl flex flex-col justify-between" style={{ minHeight: '190px' }}>
              <div className="space-y-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={22} className={ufwActive ? 'text-green-400' : 'text-red-400'} />
                    <h2 className="text-lg font-semibold">Tường lửa UFW</h2>
                  </div>
                  <span className={`status-badge ${ufwActive ? 'success' : 'danger'}`}>
                    {ufwActive ? 'Đang hoạt động' : 'Tắt'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">UFW (Uncomplicated Firewall) giúp giới hạn các kết nối mạng bất hợp pháp tới VPS của bạn.</p>
              </div>
              <button
                onClick={toggleUFW}
                className={`btn btn-block ${ufwActive ? 'btn-danger' : 'btn-success'}`}
                style={{ marginTop: '16px', padding: '10px' }}
              >
                <Power size={16} />
                {ufwActive ? 'Vô hiệu hóa Tường lửa' : 'Kích hoạt Tường lửa'}
              </button>
            </div>

            {/* Fail2Ban Panel */}
            <div className="card-glass p-6 rounded-xl flex flex-col justify-between" style={{ minHeight: '190px' }}>
              <div className="space-y-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={22} className={fail2banActive ? 'text-green-400' : 'text-yellow-400'} />
                    <h2 className="text-lg font-semibold">Fail2Ban Service</h2>
                  </div>
                  <span className={`status-badge ${fail2banActive ? 'success' : 'warning'}`}>
                    {fail2banActive ? 'Đang hoạt động' : 'Tắt / Chưa cài đặt'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">Tự động phát hiện và chặn các địa chỉ IP thực hiện brute-force dò tìm mật khẩu qua cổng SSH.</p>
              </div>
              <div className="db-warning-card" style={{ marginTop: '16px', padding: '8px 12px' }}>
                <AlertTriangle size={16} className="db-warning-icon text-yellow-400 shrink-0" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}> Fail2Ban giám sát và chặn tự động IP xấu trong nền hệ thống.</span>
              </div>
            </div>
          </div>

          {ufwActive && (
            <div className="db-layout-container">
              {/* Rules List */}
              <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Server size={18} className="text-indigo-400" />
                  Luật Tường lửa UFW
                </h3>
                {ufwRules.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Không có luật mở port tùy chỉnh nào đang được áp dụng.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="explorer-list-table">
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Mã</th>
                          <th>Cổng (To)</th>
                          <th>Hành động</th>
                          <th>Nguồn (From)</th>
                          <th style={{ textAlign: 'center', width: '60px' }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ufwRules.map((rule) => (
                          <tr key={rule.index}>
                            <td className="font-mono text-xs text-gray-400">#{rule.index}</td>
                            <td className="font-semibold text-indigo-300">{rule.to}</td>
                            <td>
                              <span className={`status-badge ${rule.action === 'ALLOW' ? 'success' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                {rule.action}
                              </span>
                            </td>
                            <td className="text-gray-300">{rule.from}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => handleDeleteRule(rule.index)}
                                className="btn btn-glass text-red-400"
                                style={{ padding: '6px' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Rule Form */}
              <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Plus size={18} className="text-green-400" />
                  Mở cổng Tường lửa
                </h3>
                <form onSubmit={handleAddRule} className="space-y-4">
                  <div className="form-group">
                    <label>Cổng cần mở (Port)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: 80, 443, 3000-3010"
                      value={portInput}
                      onChange={(e) => setPortInput(e.target.value)}
                      className="input-glass"
                    />
                  </div>

                  <div className="form-group">
                    <label>Giao thức</label>
                    <select
                      value={protoInput}
                      onChange={(e) => setProtoInput(e.target.value)}
                      className="input-glass"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="any">Bất kỳ (Both TCP/UDP)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success btn-block"
                    style={{ padding: '10px' }}
                  >
                    <Plus size={14} />
                    Áp dụng quy tắc mới
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Listening Ports */}
      {activeTab === 'ports' && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Activity size={18} className="text-indigo-400" />
              Rà soát các cổng dịch vụ đang lắng nghe (Listening Ports)
            </h3>
            <button onClick={fetchListeningPorts} disabled={portsLoading} className="btn btn-glass btn-sm flex items-center gap-2">
              <RefreshCw size={14} className={portsLoading ? 'animate-spin' : ''} />
              Quét lại
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Dưới đây là danh sách toàn bộ các cổng mạng TCP/UDP đang được mở và hoạt động trên VPS. Giúp bạn rà soát các lỗ hổng bảo mật và dịch vụ chạy ngầm.
          </p>

          {portsLoading ? (
            <div className="py-12 flex justify-center">
              <span className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : listeningPorts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Không tìm thấy thông tin cổng đang hoạt động hoặc không thể lấy dữ liệu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="explorer-list-table">
                <thead>
                  <tr>
                    <th>Giao thức</th>
                    <th>Cổng (Port)</th>
                    <th>Địa chỉ lắng nghe (IP Binding)</th>
                    <th>Tên tiến trình</th>
                    <th>PID</th>
                  </tr>
                </thead>
                <tbody>
                  {listeningPorts.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`status-badge ${item.proto === 'TCP' ? 'success' : 'warning'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                          {item.proto}
                        </span>
                      </td>
                      <td className="font-mono font-bold text-indigo-300">{item.port}</td>
                      <td className="font-mono text-gray-400 text-xs">{item.ip}</td>
                      <td className="font-semibold text-gray-200">{item.process}</td>
                      <td className="font-mono text-xs text-gray-400">{item.pid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SSH Port Changer */}
      {activeTab === 'ssh' && (
        <div className="grid-2">
          {/* SSH Changer Settings */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Key size={18} className="text-indigo-400" />
              Đổi cổng SSH đăng nhập máy chủ
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Mặc định cổng đăng nhập SSH là <code className="bg-white/5 px-1 py-0.5 rounded text-indigo-300">22</code>. Việc đổi sang một cổng ngẫu nhiên (ví dụ <code className="bg-white/5 px-1 py-0.5 rounded text-indigo-300">2222</code>, <code className="bg-white/5 px-1 py-0.5 rounded text-indigo-300">8822</code>) sẽ chặn đứng 99% các đợt tấn công dò quét mật khẩu từ bots mạng.
            </p>
            <form onSubmit={handleChangeSSHPort} className="space-y-4" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Cổng SSH mới</label>
                <input
                  type="number"
                  required
                  placeholder="Nhập cổng mong muốn (ví dụ: 2222)"
                  value={sshPortInput}
                  onChange={(e) => setSshPortInput(e.target.value)}
                  className="input-glass"
                  min="1"
                  max="65535"
                />
              </div>
              <button type="submit" disabled={sshLoading} className="btn btn-primary btn-block" style={{ padding: '10px' }}>
                {sshLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Áp dụng và Đổi Cổng SSH'}
              </button>
            </form>
          </div>

          {/* Warnings & Help */}
          <div className="card-glass p-6 rounded-xl flex flex-col justify-between" style={{ borderLeftColor: 'rgba(239, 68, 68, 0.4)' }}>
            <div className="space-y-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={22} className="text-red-400 shrink-0" />
                <h3 className="text-lg font-semibold text-red-300">Cảnh báo An toàn quan trọng</h3>
              </div>
              <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
                <p>
                  ⚠️ **Tránh ngắt kết nối**: Panel sẽ tự động thêm luật mở cổng mới trên tường lửa UFW trước khi đổi. Tuy nhiên, nếu bạn dùng Firewall của nhà cung cấp VPS (AWS SG, Google Firewall, Azure NSG...), bạn **PHẢI** mở cổng tương ứng trên Dashboard nhà cung cấp đó trước.
                </p>
                <p>
                  ⚠️ **Cập nhật cổng trên Panel**: Sau khi cổng SSH được đổi thành công, VPS sẽ đóng cổng 22. Bạn cần bấm vào nút **"Đổi VPS"** trên thanh Sidebar và thay đổi cấu hình Cổng của VPS này sang cổng mới để tiếp tục quản lý.
                </p>
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg flex gap-2 items-center text-xs text-gray-300">
              <Lock size={14} className="text-indigo-400 shrink-0" />
              <span>SSH Daemon sẽ được khởi động lại ngầm trên VPS.</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SSL Panel Domain Config */}
      {activeTab === 'ssl' && (
        <div className="grid-2">
          {/* SSL Config Form */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Globe size={18} className="text-indigo-400" />
              Cấu hình Tên miền & SSL (HTTPS) bảo mật cho Panel
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Kích hoạt chứng chỉ mã hóa SSL HTTPS cho chính bảng điều khiển này. Giúp mã hóa đầu cuối thông tin đăng nhập và kết nối VPS từ xa của bạn.
            </p>
            <form onSubmit={handleConfigurePanelSSL} className="space-y-4" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label>Tên miền truy cập Panel (Domain)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: panel.cua-ban.com"
                  value={sslDomain}
                  onChange={(e) => setSslDomain(e.target.value)}
                  className="input-glass"
                />
              </div>
              <div className="form-group">
                <label>Email liên hệ Let's Encrypt</label>
                <input
                  type="email"
                  required
                  placeholder="Ví dụ: admin@gmail.com"
                  value={sslEmail}
                  onChange={(e) => setSslEmail(e.target.value)}
                  className="input-glass"
                />
              </div>
              <button type="submit" disabled={sslLoading} className="btn btn-success btn-block" style={{ padding: '10px' }}>
                {sslLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Xin chứng chỉ SSL & Cấu hình HTTPS'}
              </button>
            </form>
          </div>

          {/* Help & Result */}
          <div className="card-glass p-6 rounded-xl flex flex-col justify-between">
            {sslResult ? (
              <div className="space-y-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={22} className="text-green-400" />
                  <h3 className="text-lg font-semibold text-green-300">Cấu hình thành công!</h3>
                </div>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>Chứng chỉ Let's Encrypt SSL đã được cài đặt và Nginx đã được thiết lập reverse proxy.</p>
                  <p>Từ giờ, bạn có thể truy cập Panel an toàn qua liên kết sau:</p>
                  <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg font-mono text-center">
                    <a href={sslResult.url} target="_blank" rel="noreferrer" className="text-green-400 hover:underline font-bold">
                      {sslResult.url}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={22} className="text-yellow-400 shrink-0" />
                  <h3 className="text-lg font-semibold text-yellow-300">Yêu cầu chuẩn bị DNS trước</h3>
                </div>
                <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
                  <p>
                    1. **Trỏ tên miền (DNS)**: Bạn cần vào quản lý tên miền (như Cloudflare, Tenten...) tạo bản ghi **A Record** trỏ tên miền (ví dụ: `panel.cua-ban.com`) về địa chỉ IP của VPS này trước.
                  </p>
                  <p>
                    2. **Chờ phân giải**: Chờ từ 1-5 phút cho DNS phân giải thành công.
                  </p>
                  <p>
                    3. **Chạy xin SSL**: Khi Nginx kiểm tra thấy tên miền đã phân giải đúng về VPS, Certbot mới có thể cấp phát chứng chỉ SSL Let's Encrypt miễn phí thành công.
                  </p>
                </div>
              </div>
            )}
            <div className="bg-white/5 p-3 rounded-lg flex gap-2 items-center text-xs text-gray-300">
              <Lock size={14} className="text-indigo-400 shrink-0" />
              <span>Chứng chỉ Let's Encrypt SSL tự động gia hạn sau mỗi 90 ngày.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
