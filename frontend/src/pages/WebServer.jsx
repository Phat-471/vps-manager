import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { RotateCw, Plus, Globe, Settings, ShieldCheck, Trash, X, Database, ShieldAlert, FileText, HelpCircle } from 'lucide-react';

export default function WebServer() {
  const { apiCall, showToast, isConnected, currentVPS } = useVPS();
  const [sites, setSites] = useState([]);
  
  const isCloudflareIP = (ip) => {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length < 4) return false;
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    if (p1 === 104 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 172 && p2 >= 64 && p2 <= 71) return true;
    if (p1 === 108 && p2 === 162) return true;
    return false;
  };
  const [nginxOnline, setNginxOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Tab control state
  const [activeTab, setActiveTab] = useState('sites'); // 'sites' | 'dns' | 'hosts'
  
  // DNS Diagnostic state
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsResults, setDnsResults] = useState(null);
  const [checkingDns, setCheckingDns] = useState(false);
  
  // Hosts management state
  const [hostsContent, setHostsContent] = useState('');
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [savingHosts, setSavingHosts] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Form state
  const [domain, setDomain] = useState('');
  const [path, setPath] = useState('/var/www/html');
  const [type, setType] = useState('php');
  const [proxyPort, setProxyPort] = useState('3000');
  const [antiDdos, setAntiDdos] = useState(false);
  const [blockBots, setBlockBots] = useState(false);
  
  // Config Editor state
  const [editingDomain, setEditingDomain] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const handleOpenAddModal = () => {
    setDomain('');
    setPath('/var/www/html');
    setType('php');
    setProxyPort('3000');
    setAntiDdos(false);
    setBlockBots(false);
    setShowAddModal(true);
  };


  const loadSites = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/api/webserver/list', 'POST');
      if (result.success) {
        setSites(result.data || []);
      }
    } catch (err) {
      showToast('Không thể tải danh sách website', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkNginxStatus = async () => {
    try {
      const result = await apiCall('/api/webserver/status', 'POST');
      if (result.success) {
        setNginxOnline(result.data.active);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadSites();
      checkNginxStatus();
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && activeTab === 'hosts') {
      loadHosts();
    }
  }, [activeTab, isConnected]);

  const loadHosts = async () => {
    setLoadingHosts(true);
    try {
      const res = await apiCall('/api/webserver/get-hosts', 'POST');
      if (res.success) {
        setHostsContent(res.data || '');
      }
    } catch (err) {
      showToast('Lỗi khi đọc file hosts: ' + err.message, 'error');
    } finally {
      setLoadingHosts(false);
    }
  };

  const handleSaveHosts = async () => {
    setSavingHosts(true);
    try {
      const res = await apiCall('/api/webserver/save-hosts', 'POST', { content: hostsContent });
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (err) {
      showToast('Lỗi khi lưu file hosts: ' + err.message, 'error');
    } finally {
      setSavingHosts(false);
    }
  };

  const handleCheckDNS = async (e) => {
    e.preventDefault();
    if (!dnsDomain.trim()) return;
    setCheckingDns(true);
    setDnsResults(null);
    try {
      const res = await apiCall('/api/webserver/check-dns', 'POST', { domain: dnsDomain.trim() });
      if (res.success) {
        setDnsResults(res.data);
      }
    } catch (err) {
      showToast('Lỗi khi tra cứu DNS: ' + err.message, 'error');
    } finally {
      setCheckingDns(false);
    }
  };


  const handleAddSite = async (e) => {
    e.preventDefault();
    if (!domain) {
      showToast('Vui lòng nhập tên miền', 'warning');
      return;
    }

    showToast(`Đang khởi tạo website ${domain}...`, 'info');
    try {
      const result = await apiCall('/api/webserver/add', 'POST', {
        domain,
        root: path,
        type,
        proxyPort: type === 'proxy' ? proxyPort : '',
        antiDdos,
        blockBots
      });

      if (result.success) {
        showToast('Đã thêm website thành công!', 'success');
        setShowAddModal(false);
        setDomain('');
        loadSites();
      }
    } catch (err) {
      showToast('Lỗi khi thêm website: ' + err.message, 'error');
    }
  };

  const handleDeleteSite = async (domainName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa website ${domainName}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    try {
      const result = await apiCall('/api/webserver/delete', 'POST', { domain: domainName });
      if (result.success) {
        showToast(`Đã xóa website ${domainName}`, 'success');
        loadSites();
      }
    } catch (err) {
      showToast('Lỗi khi xóa website', 'error');
    }
  };

  const handleToggleSite = async (domainName, isEnabled) => {
    try {
      await apiCall('/api/webserver/toggle', 'POST', { domain: domainName, enable: isEnabled });
      showToast(`${isEnabled ? 'Kích hoạt' : 'Hủy kích hoạt'} ${domainName} thành công`, 'success');
      // Update local state instantly
      setSites(prev => prev.map(s => s.domain === domainName ? { ...s, enabled: isEnabled } : s));
    } catch (err) {
      showToast('Lỗi khi thay đổi trạng thái', 'error');
      loadSites();
    }
  };

  const handleEditConfig = async (domainName) => {
    try {
      const result = await apiCall('/api/webserver/config', 'POST', { domain: domainName });
      if (result.success) {
        setEditingDomain(domainName);
        setConfigContent(result.data || '');
        setShowConfigModal(true);
      }
    } catch (err) {
      showToast('Lỗi khi tải cấu hình', 'error');
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const result = await apiCall('/api/webserver/save-config', 'POST', {
        domain: editingDomain,
        config: configContent
      });
      if (result.success) {
        showToast('Đã lưu cấu hình và tải lại Nginx thành công', 'success');
        setShowConfigModal(false);
      }
    } catch (err) {
      showToast('Lỗi khi lưu cấu hình: ' + err.message, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleInstallSSL = async (domainName) => {
    const email = window.prompt('Nhập email để nhận thông báo từ Let\'s Encrypt (tùy chọn):', `admin@${domainName}`);
    if (email === null) return;

    showToast(`Đang cài đặt SSL cho ${domainName}...`, 'info');
    try {
      const result = await apiCall('/api/webserver/ssl', 'POST', { domain: domainName, email });
      if (result.success) {
        showToast('Cài đặt SSL thành công!', 'success');
      }
    } catch (err) {
      showToast('Lỗi khi cài SSL: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Quản lý Web Server (Nginx)
            <span className={`status-badge ${nginxOnline ? 'success' : 'danger'}`} style={{ textTransform: 'none', fontSize: '12px' }}>
              {nginxOnline ? 'Online' : 'Offline'}
            </span>
          </h1>
          <p className="text-sm text-gray-400">Thiết lập cấu hình virtual host Nginx, đảo ngược proxy và tạo chứng chỉ Let's Encrypt SSL</p>
        </div>
        <div className="explorer-toolbar">
          <button className="btn btn-glass" onClick={loadSites} disabled={loading}>
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={16} />
            Thêm Website
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="db-tabs-container">
        <button 
          className={`db-tab-item ${activeTab === 'sites' ? 'active' : ''}`}
          onClick={() => setActiveTab('sites')}
        >
          <Globe size={16} />
          Danh sách Website
        </button>
        <button 
          className={`db-tab-item ${activeTab === 'dns' ? 'active' : ''}`}
          onClick={() => setActiveTab('dns')}
        >
          <HelpCircle size={16} />
          Tra cứu & Phân tích DNS
        </button>
        <button 
          className={`db-tab-item ${activeTab === 'hosts' ? 'active' : ''}`}
          onClick={() => setActiveTab('hosts')}
        >
          <FileText size={16} />
          Cấu hình file Hosts (/etc/hosts)
        </button>
      </div>

      {/* Tab 1: Sites List */}
      {activeTab === 'sites' && (
        <div className="card-glass p-6 rounded-xl">
          {sites.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {loading ? 'Đang quét cấu hình Nginx...' : 'Chưa có website nào được cài đặt.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="explorer-list-table">
                <thead>
                  <tr>
                    <th>Tên miền</th>
                    <th>Thư mục root</th>
                    <th>Loại</th>
                    <th>Kích hoạt</th>
                    <th style={{ textAlign: 'center', width: '250px' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map(site => (
                    <tr key={site.domain}>
                      <td className="font-semibold text-gray-200">
                        <div className="explorer-list-name-col">
                          <Globe size={16} className="text-indigo-400 shrink-0" />
                          <span className="explorer-list-name">{site.domain}</span>
                        </div>
                      </td>
                      <td>
                        <code className="bg-white/5 px-2 py-1 rounded font-mono text-xs text-indigo-300" style={{ wordBreak: 'break-all' }}>{site.root}</code>
                      </td>
                      <td>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/5 text-gray-300" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                          {site.type ? site.type.toUpperCase() : 'PHP'}
                        </span>
                      </td>
                      <td>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={site.enabled} 
                            onChange={e => handleToggleSite(site.domain, e.target.checked)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn btn-glass btn-sm text-indigo-300" onClick={() => handleEditConfig(site.domain)}>
                            <Settings size={12} /> Config
                          </button>
                          <button className="btn btn-glass btn-sm text-green-400" onClick={() => handleInstallSSL(site.domain)}>
                            <ShieldCheck size={12} /> SSL
                          </button>
                          <button className="btn btn-glass btn-sm text-red-400" onClick={() => handleDeleteSite(site.domain)}>
                            <Trash size={12} /> Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: DNS Diagnostic */}
      {activeTab === 'dns' && (
        <div className="db-layout-container">
          {/* Diagnostic Form */}
          <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4" style={{ height: 'fit-content' }}>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Globe size={18} className="text-indigo-400" />
              Tra cứu bản ghi DNS
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Kiểm tra xem tên miền của bạn đã trỏ chính xác về địa chỉ IP của VPS chưa trước khi cài đặt SSL hoặc mã nguồn.
            </p>
            <form onSubmit={handleCheckDNS} className="space-y-4">
              <div className="form-group">
                <label>Tên miền (Domain)</label>
                <input
                  type="text"
                  required
                  placeholder="vd: mywebsite.com"
                  value={dnsDomain}
                  onChange={(e) => setDnsDomain(e.target.value)}
                  className="input-glass"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={checkingDns}>
                {checkingDns ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
              </button>
            </form>
          </div>

          {/* Diagnostic Results */}
          <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Database size={18} className="text-green-400" />
              Kết quả tra cứu DNS
            </h3>

            {!dnsResults ? (
              <div className="text-center py-12 text-gray-400">
                Vui lòng nhập tên miền ở cột bên trái để phân tích các bản ghi DNS.
              </div>
            ) : (
              <div className="space-y-4">
                {/* IP Match Warning */}
                {dnsResults.ip.includes(currentVPS?.host) ? (
                  <div className="status-badge success btn-block text-center py-2" style={{ textTransform: 'none', display: 'block', fontSize: '13px', borderRadius: '8px' }}>
                    ✔ Tên miền {dnsResults.domain} đã trỏ chính xác về IP VPS này ({currentVPS?.host}). Bạn có thể cài đặt SSL ngay.
                  </div>
                ) : (
                  <div className="db-warning-card">
                    <ShieldAlert className="db-warning-icon text-red-500" size={24} />
                    <div className="db-warning-text">
                      <strong className="db-warning-title text-red-400" style={{ fontSize: '14px' }}>Cảnh báo: Tên miền chưa trỏ về VPS!</strong>
                      <p className="text-gray-400" style={{ marginTop: '4px' }}>
                        Tên miền <strong>{dnsResults.domain}</strong> đang trỏ về IP: <strong className="text-yellow-400">{dnsResults.ip.join(', ')}</strong>.
                        Bạn cần tạo bản ghi A trong cấu hình DNS tên miền của bạn trỏ về IP của VPS này: <strong className="text-indigo-300">{currentVPS?.host}</strong>.
                      </p>
                      {dnsResults.ip.some(isCloudflareIP) && (
                        <p className="text-yellow-400 font-semibold mt-2" style={{ fontSize: '12px', lineHeight: '1.4' }}>
                          💡 Nhận diện: Tên miền đang bật chế độ Proxied (Đám mây màu cam) trên Cloudflare. Chế độ này che giấu IP thực của VPS. 
                          Để kiểm tra chính xác hoặc cài đặt chứng chỉ SSL Let's Encrypt, bạn hãy chỉnh sửa bản ghi DNS trên Cloudflare thành "DNS Only" (Đám mây màu xám).
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Table of records */}
                <table className="explorer-list-table">
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>Loại bản ghi</th>
                      <th>Giá trị phân giải được</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-semibold text-gray-300">A (IPv4 Address)</td>
                      <td className="font-mono text-xs text-indigo-300">{dnsResults.ip.join(', ')}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-gray-300">NS (Name Servers)</td>
                      <td className="font-mono text-xs text-gray-200">
                        {dnsResults.ns.map((ns, idx) => (
                          <div key={idx}>{ns}</div>
                        ))}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-gray-300">MX (Mail Servers)</td>
                      <td className="font-mono text-xs text-gray-400">
                        {dnsResults.mx.map((mx, idx) => (
                          <div key={idx}>{mx}</div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Hosts config */}
      {activeTab === 'hosts' && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FileText size={18} className="text-indigo-400" />
                Cấu hình tệp tin /etc/hosts
              </h3>
              <p className="text-xs text-gray-400">Chỉ định tên miền trỏ cục bộ tới các địa chỉ IP trên VPS (Local IP DNS Resolver).</p>
            </div>
            <button className="btn btn-primary" onClick={handleSaveHosts} disabled={savingHosts || loadingHosts}>
              {savingHosts ? 'Đang lưu...' : 'Lưu cấu hình hosts'}
            </button>
          </div>

          {loadingHosts ? (
            <div className="text-center py-12 text-gray-400">Đang đọc dữ liệu tệp tin hosts...</div>
          ) : (
            <textarea
              value={hostsContent}
              onChange={(e) => setHostsContent(e.target.value)}
              className="input-glass"
              style={{ height: '350px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
            />
          )}
        </div>
      )}

      {/* Add Site Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2>Thêm Website Mới</h2>
              <button onClick={() => setShowAddModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSite}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label>Tên miền (Domain)</label>
                  <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.com" className="input-glass" required />
                </div>
                <div className="form-group">
                  <label>Thư mục gốc (Root Path)</label>
                  <input type="text" value={path} onChange={e => setPath(e.target.value)} className="input-glass font-mono" required />
                </div>
                <div className="form-group">
                  <label>Loại Website</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="input-glass">
                    <option value="php">PHP App (Laravel, WordPress...)</option>
                    <option value="static">Static HTML/JS</option>
                    <option value="proxy">Reverse Proxy (Node.js, Python...)</option>
                  </select>
                </div>
                {type === 'proxy' && (
                  <div className="form-group">
                    <label>Proxy Port</label>
                    <input type="number" value={proxyPort} onChange={e => setProxyPort(e.target.value)} placeholder="3000" className="input-glass" required />
                  </div>
                )}
                
                {/* Security settings */}
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <label className="text-xs text-indigo-300 font-semibold block uppercase tracking-wider">Bảo mật nâng cao</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white transition-all">
                      <input 
                        type="checkbox" 
                        checked={antiDdos} 
                        onChange={e => setAntiDdos(e.target.checked)} 
                        className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                      />
                      Kích hoạt Chống DDoS & Rate Limit Nginx
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white transition-all">
                      <input 
                        type="checkbox" 
                        checked={blockBots} 
                        onChange={e => setBlockBots(e.target.checked)} 
                        className="rounded bg-white/5 border-white/10 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                      />
                      Chặn Crawler & Bots xấu (Ahrefs, Semrush, Scrapers...)
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-glass" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Tạo Website</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Config Modal */}
      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h2>Cấu hình Nginx: {editingDomain}</h2>
              <button onClick={() => setShowConfigModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <textarea 
                value={configContent} 
                onChange={e => setConfigContent(e.target.value)}
                className="input-glass"
                style={{ height: '400px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-glass" onClick={() => setShowConfigModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? 'Đang lưu...' : 'Lưu & Reload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
