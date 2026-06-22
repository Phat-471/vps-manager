import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { RotateCw, Plus, Globe, Settings, ShieldCheck, Trash, X, Database, ShieldAlert, FileText, HelpCircle, ScanSearch, Wrench, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('sites'); // 'sites' | 'ssl' | 'dns' | 'hosts'
  
  // SSL management state
  const [sslCerts, setSslCerts] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [renewingAll, setRenewingAll] = useState(false);
  const [settingCron, setSettingCron] = useState(false);

  // Advanced SSL states
  const [sslMode, setSslMode] = useState('standard'); // 'standard' | 'wildcard' | 'custom'
  const [wildcardDomain, setWildcardDomain] = useState('');
  const [wildcardEmail, setWildcardEmail] = useState('');
  const [cfEmail, setCfEmail] = useState('');
  const [cfKey, setCfKey] = useState('');
  const [cfToken, setCfToken] = useState('');
  const [cfAuthMode, setCfAuthMode] = useState('token'); // 'token' | 'key'
  const [customDomain, setCustomDomain] = useState('');
  const [customCertText, setCustomCertText] = useState('');
  const [customKeyText, setCustomKeyText] = useState('');
  const [submittingSsl, setSubmittingSsl] = useState(false);
  
  // SSL Auto-Renew & Dry-Run state
  const [cronStatus, setCronStatus] = useState({ active: false, checked: false, schedule: '', command: '' });
  const [checkingCron, setCheckingCron] = useState(false);
  const [testingRenew, setTestingRenew] = useState(false);
  const [renewTestLogs, setRenewTestLogs] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  
  // DNS Diagnostic state
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsResults, setDnsResults] = useState(null);
  const [checkingDns, setCheckingDns] = useState(false);
  
  // Hosts management state
  const [hostsContent, setHostsContent] = useState('');
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [savingHosts, setSavingHosts] = useState(false);

  // Nginx Config Scanner state (Phase 4)
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [fixingIssue, setFixingIssue] = useState(null); // key: `${file}:${fixType}`
  const [expandedFile, setExpandedFile] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Form state
  const [domain, setDomain] = useState('');
  const [path, setPath] = useState('/var/www/html');
  const [type, setType] = useState('php');
  const [phpVersion, setPhpVersion] = useState('8.2');
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
    setPhpVersion('8.2');
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

  useEffect(() => {
    if (isConnected && activeTab === 'scanner') {
      // Auto-scan when opening the scanner tab
      if (!scanResult) handleScanNginx();
    }
  }, [activeTab, isConnected]);

  useEffect(() => {
    if (isConnected && activeTab === 'ssl') {
      loadSSLCerts();
      loadCronStatus();
    }
  }, [activeTab, isConnected]);

  const loadSSLCerts = async () => {
    setLoadingCerts(true);
    try {
      const result = await apiCall('/api/webserver/ssl/list', 'POST');
      if (result.success) {
        setSslCerts(result.data || []);
      }
    } catch (err) {
      showToast('Không thể tải danh sách chứng chỉ SSL: ' + err.message, 'error');
    } finally {
      setLoadingCerts(false);
    }
  };

  const loadCronStatus = async () => {
    setCheckingCron(true);
    try {
      const result = await apiCall('/api/webserver/ssl/check-cron', 'POST');
      if (result.success) {
        setCronStatus({
          active: result.active,
          checked: true,
          schedule: result.schedule,
          command: result.command
        });
      }
    } catch (err) {
      console.error('Lỗi kiểm tra cron:', err);
    } finally {
      setCheckingCron(false);
    }
  };

  const handleRenewAllSSL = async () => {
    if (!window.confirm('Bạn có muốn thực hiện gia hạn tất cả chứng chỉ SSL ngay lập tức không?')) return;
    setRenewingAll(true);
    showToast('Đang thực hiện yêu cầu gia hạn chứng chỉ SSL...', 'info');
    try {
      const result = await apiCall('/api/webserver/ssl/renew-all', 'POST');
      if (result.success) {
        showToast('Gia hạn SSL hoàn tất!', 'success');
        loadSSLCerts();
      }
    } catch (err) {
      showToast('Lỗi gia hạn SSL: ' + err.message, 'error');
    } finally {
      setRenewingAll(false);
    }
  };

  const handleSetupCronSSL = async () => {
    setSettingCron(true);
    showToast('Đang thiết lập Cron Job tự động gia hạn...', 'info');
    try {
      const result = await apiCall('/api/webserver/ssl/setup-cron', 'POST');
      if (result.success) {
        showToast(result.message, 'success');
        await loadCronStatus();
      }
    } catch (err) {
      showToast('Lỗi thiết lập Cron Job: ' + err.message, 'error');
    } finally {
      setSettingCron(false);
    }
  };

  const handleTestSSLAutoRenew = async () => {
    setTestingRenew(true);
    setRenewTestLogs('Đang chạy certbot dry-run, vui lòng đợi...\n');
    setShowTestModal(true);
    try {
      const result = await apiCall('/api/webserver/ssl/test-dryrun', 'POST');
      if (result.success) {
        let logMsg = `[MÃ THOÁT]: ${result.code}\n\n`;
        if (result.stdout) logMsg += `--- STDOUT ---\n${result.stdout}\n`;
        if (result.stderr) logMsg += `--- STDERR ---\n${result.stderr}\n`;
        setRenewTestLogs(logMsg);
        if (result.code === 0) {
          showToast('Chạy thử gia hạn SSL Let\'s Encrypt thành công!', 'success');
        } else {
          showToast('Chạy thử gia hạn SSL báo lỗi!', 'warning');
        }
      }
    } catch (err) {
      setRenewTestLogs(`LỖI HỆ THỐNG:\n${err.message}`);
      showToast('Không thể chạy thử gia hạn SSL: ' + err.message, 'error');
    } finally {
      setTestingRenew(false);
    }
  };

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
        phpVersion: type === 'php' ? phpVersion : '',
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

  const handleToggleSecurity = async (domainName, newAntiDdos, newBlockBots) => {
    try {
      showToast(`Đang cập nhật bảo mật cho ${domainName}...`, 'info');
      const result = await apiCall('/api/webserver/update-security', 'POST', {
        domain: domainName,
        antiDdos: newAntiDdos,
        blockBots: newBlockBots
      });
      if (result.success) {
        showToast(result.message, 'success');
        setSites(prev => prev.map(s => s.domain === domainName ? { ...s, antiDdos: newAntiDdos, blockBots: newBlockBots } : s));
      }
    } catch (err) {
      showToast('Lỗi khi cập nhật cấu hình bảo mật: ' + err.message, 'error');
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
    if (currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1') {
      showToast('Không thể cài đặt Let\'s Encrypt SSL ở chế độ Native Mode (Localhost). Yêu cầu VPS có IP Public thực tế.', 'warning');
      return;
    }
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

  const handleInstallWildcardSSL = async (e) => {
    e.preventDefault();
    if (currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1') {
      showToast('Không thể cài đặt SSL Wildcard ở chế độ Native Mode (Localhost).', 'warning');
      return;
    }
    if (!wildcardDomain.trim()) {
      showToast('Vui lòng nhập tên miền', 'warning');
      return;
    }
    setSubmittingSsl(true);
    showToast(`Đang cấu hình cài đặt SSL Wildcard cho *.${wildcardDomain}...`, 'info');
    try {
      const payload = {
        domain: wildcardDomain.trim(),
        email: wildcardEmail.trim(),
      };
      if (cfAuthMode === 'token') {
        payload.cfToken = cfToken.trim();
      } else {
        payload.cfEmail = cfEmail.trim();
        payload.cfKey = cfKey.trim();
      }

      const res = await apiCall('/api/webserver/ssl/wildcard', 'POST', payload);
      if (res.success) {
        showToast(res.message, 'success');
        loadSSLCerts();
        // Reset form
        setWildcardDomain('');
        setWildcardEmail('');
        setCfEmail('');
        setCfKey('');
        setCfToken('');
      }
    } catch (err) {
      showToast('Lỗi cài SSL Wildcard: ' + err.message, 'error');
    } finally {
      setSubmittingSsl(false);
    }
  };

  const handleInstallCustomSSL = async (e) => {
    e.preventDefault();
    if (!customDomain.trim()) {
      showToast('Vui lòng chọn hoặc nhập tên miền', 'warning');
      return;
    }
    if (!customCertText.trim() || !customKeyText.trim()) {
      showToast('Vui lòng nhập đầy đủ Certificate và Private Key', 'warning');
      return;
    }
    setSubmittingSsl(true);
    showToast(`Đang cài đặt Custom SSL cho ${customDomain}...`, 'info');
    try {
      const res = await apiCall('/api/webserver/ssl/custom', 'POST', {
        domain: customDomain.trim(),
        certText: customCertText,
        keyText: customKeyText
      });
      if (res.success) {
        showToast(res.message, 'success');
        loadSSLCerts();
        // Reset form
        setCustomDomain('');
        setCustomCertText('');
        setCustomKeyText('');
      }
    } catch (err) {
      showToast('Lỗi cài Custom SSL: ' + err.message, 'error');
    } finally {
      setSubmittingSsl(false);
    }
  };

  const handleScanNginx = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await apiCall('/api/webserver/nginx/scan', 'POST');
      if (res.success) {
        setScanResult(res.data);
        if (res.data.passed) {
          showToast('Nginx cấu hình hợp lệ — không phát hiện lỗi!', 'success');
        } else {
          showToast(`Phát hiện ${res.data.errors.length} vấn đề cấu hình Nginx!`, 'warning');
        }
      }
    } catch (err) {
      showToast('Lỗi khi quét cấu hình Nginx: ' + err.message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleFixNginx = async (fixType, filePath, lineNumber) => {
    const key = `${filePath}:${fixType}`;
    setFixingIssue(key);
    try {
      const res = await apiCall('/api/webserver/nginx/fix', 'POST', { fixType, filePath, lineNumber });
      if (res.success && res.data.applied) {
        showToast('Đã áp dụng bản vá thành công! Nginx đã được reload.', 'success');
        await handleScanNginx(); // Re-scan after fix
      } else {
        showToast('Áp dụng bản vá thất bại. Kiểm tra log để biết thêm.', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi áp dụng bản vá: ' + err.message, 'error');
    } finally {
      setFixingIssue(null);
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
          className={`db-tab-item ${activeTab === 'ssl' ? 'active' : ''}`}
          onClick={() => setActiveTab('ssl')}
        >
          <ShieldCheck size={16} />
          Quản lý SSL Let's Encrypt
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
        <button 
          className={`db-tab-item ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
          style={{ position: 'relative' }}
        >
          <ScanSearch size={16} />
          Nginx Config Scanner
          {scanResult && !scanResult.passed && (
            <span style={{
              position: 'absolute', top: '4px', right: '4px',
              background: '#ef4444', borderRadius: '50%',
              width: '8px', height: '8px'
            }} />
          )}
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
                    <th>Anti-DDoS</th>
                    <th>Chặn Bot</th>
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
                            checked={site.antiDdos || false} 
                            onChange={e => handleToggleSecurity(site.domain, e.target.checked, site.blockBots)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </td>
                      <td>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={site.blockBots || false} 
                            onChange={e => handleToggleSecurity(site.domain, site.antiDdos, e.target.checked)}
                          />
                          <span className="switch-slider"></span>
                        </label>
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

      {/* Tab: SSL Certificates */}
      {activeTab === 'ssl' && (
        <div className="card-glass p-6 rounded-xl space-y-6">
          {(currentVPS?.host === 'localhost' || currentVPS?.host === '127.0.0.1') && (
            <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-xs text-yellow-300 leading-relaxed flex items-center gap-2.5">
              <ShieldAlert className="text-yellow-400 shrink-0" size={20} />
              <div>
                <strong>Cảnh báo Native Mode (Localhost)</strong>
                <p className="text-gray-400 text-[10px] mt-0.5">Let's Encrypt SSL yêu cầu VPS có IP Public công khai và tên miền đã được trỏ DNS chính xác. Bạn không thể đăng ký hoặc gia hạn tự động SSL ở chế độ Native Mode (localhost).</p>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShieldCheck size={18} className="text-green-400" />
                Danh sách chứng chỉ SSL Let's Encrypt
              </h3>
              <p className="text-xs text-gray-400">Xem và quản lý tự động gia hạn các chứng chỉ SSL được cài đặt trên VPS của bạn.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-glass text-xs" 
                onClick={handleTestSSLAutoRenew} 
                disabled={testingRenew || loadingCerts}
              >
                {testingRenew ? 'Đang chạy thử...' : 'Chạy thử gia hạn (Dry-run)'}
              </button>
              <button 
                className="btn btn-glass text-xs" 
                onClick={handleSetupCronSSL} 
                disabled={settingCron || loadingCerts}
              >
                {settingCron ? 'Đang cài đặt...' : 'Cấu hình Cron gia hạn'}
              </button>
              <button 
                className="btn btn-primary text-xs" 
                onClick={handleRenewAllSSL} 
                disabled={renewingAll || loadingCerts}
              >
                {renewingAll ? 'Đang gia hạn...' : 'Gia hạn tất cả ngay'}
              </button>
            </div>
          </div>

          {/* Cron Auto-Renew Status Banner */}
          {cronStatus.checked && (
            <div className={`p-4 rounded-xl border flex items-center justify-between text-xs leading-relaxed ${
              cronStatus.active 
                ? 'bg-green-500/5 border-green-500/20 text-green-300' 
                : 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300'
            }`}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={cronStatus.active ? 'text-green-400' : 'text-yellow-400'} />
                <div>
                  <strong>{cronStatus.active ? 'Đã kích hoạt gia hạn tự động qua Cron' : 'Chưa kích hoạt gia hạn tự động qua Cron'}</strong>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    {cronStatus.active 
                      ? `Lịch chạy: ${cronStatus.schedule} (Hàng ngày lúc 00:00) | Câu lệnh: ${cronStatus.command}`
                      : 'Nên cấu hình để hệ thống tự động kiểm tra và gia hạn các chứng chỉ SSL sắp hết hạn.'
                    }
                  </p>
                </div>
              </div>
              {!cronStatus.active && (
                <button 
                  className="btn btn-glass btn-xs text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10"
                  onClick={handleSetupCronSSL}
                  disabled={settingCron}
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  {settingCron ? 'Đang thiết lập...' : 'Kích hoạt ngay'}
                </button>
              )}
            </div>
          )}

          {loadingCerts ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              <RotateCw size={18} className="animate-spin mx-auto mb-2 text-green-500" />
              Đang quét chứng chỉ SSL trên VPS...
            </div>
          ) : sslCerts.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Chưa tìm thấy chứng chỉ SSL Let's Encrypt nào trên hệ thống VPS này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="explorer-list-table">
                <thead>
                  <tr>
                    <th>Tên chứng chỉ</th>
                    <th>Tên miền được bảo vệ</th>
                    <th>Ngày hết hạn</th>
                    <th>Thời gian còn lại</th>
                    <th style={{ textAlign: 'center' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {sslCerts.map(cert => (
                    <tr key={cert.name}>
                      <td className="font-semibold text-gray-200">{cert.name}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {cert.domains.map(dom => (
                            <code key={dom} className="bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-indigo-300">{dom}</code>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-300">{cert.expiryDate}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`text-xs font-bold ${cert.daysRemaining < 30 ? 'text-red-400' : 'text-green-400'}`}>
                            {cert.daysRemaining} ngày
                          </span>
                          <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, (cert.daysRemaining / 90) * 100)}%`, 
                              height: '100%', 
                              background: cert.daysRemaining < 30 ? '#ef4444' : '#22c55e' 
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${cert.valid ? 'success' : 'danger'}`}>
                          {cert.valid ? 'Hợp lệ' : 'Hết hạn / Lỗi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Advanced SSL Tools */}
          <div className="border-t border-white/5 pt-6 space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Cài đặt chứng chỉ SSL nâng cao</h4>
            
            <div className="flex gap-2">
              <button 
                type="button" 
                className={`btn btn-sm ${sslMode === 'wildcard' ? 'btn-primary' : 'btn-glass'}`}
                onClick={() => setSslMode(sslMode === 'wildcard' ? 'standard' : 'wildcard')}
              >
                Cài đặt SSL Wildcard (Cloudflare)
              </button>
              <button 
                type="button" 
                className={`btn btn-sm ${sslMode === 'custom' ? 'btn-primary' : 'btn-glass'}`}
                onClick={() => setSslMode(sslMode === 'custom' ? 'standard' : 'custom')}
              >
                Cấu hình SSL Custom (Tự tải lên)
              </button>
            </div>

            {sslMode === 'wildcard' && (
              <form onSubmit={handleInstallWildcardSSL} className="card-glass p-5 rounded-lg space-y-4 text-sm max-w-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-indigo-400">Đăng ký SSL Wildcard Let's Encrypt (*.domain.com)</h5>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">DNS-01 Challenge</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Tên miền (Domain gốc):</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="vd: mywebsite.com" 
                      value={wildcardDomain}
                      onChange={e => setWildcardDomain(e.target.value)}
                      className="input-glass w-full text-xs" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Email quản trị (Let's Encrypt):</label>
                    <input 
                      type="email" 
                      placeholder="vd: admin@mywebsite.com" 
                      value={wildcardEmail}
                      onChange={e => setWildcardEmail(e.target.value)}
                      className="input-glass w-full text-xs" 
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/5 pt-3">
                  <label className="text-gray-400 font-medium block">Xác thực DNS qua Cloudflare:</label>
                  
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input 
                        type="radio" 
                        name="cfAuthMode" 
                        checked={cfAuthMode === 'token'}
                        onChange={() => setCfAuthMode('token')} 
                      />
                      Sử dụng Cloudflare API Token (Khuyên dùng)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input 
                        type="radio" 
                        name="cfAuthMode" 
                        checked={cfAuthMode === 'key'}
                        onChange={() => setCfAuthMode('key')} 
                      />
                      Sử dụng Global API Key
                    </label>
                  </div>

                  {cfAuthMode === 'token' ? (
                    <div className="space-y-1">
                      <label className="text-gray-400 text-xs">Cloudflare API Token:</label>
                      <input 
                        type="password" 
                        required 
                        placeholder="Nhập Cloudflare API Token của bạn" 
                        value={cfToken}
                        onChange={e => setCfToken(e.target.value)}
                        className="input-glass w-full text-xs font-mono" 
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs">Email tài khoản Cloudflare:</label>
                        <input 
                          type="email" 
                          required 
                          placeholder="vd: email@cloudflare.com" 
                          value={cfEmail}
                          onChange={e => setCfEmail(e.target.value)}
                          className="input-glass w-full text-xs" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs">Cloudflare Global API Key:</label>
                        <input 
                          type="password" 
                          required 
                          placeholder="Nhập Global API Key" 
                          value={cfKey}
                          onChange={e => setCfKey(e.target.value)}
                          className="input-glass w-full text-xs font-mono" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn btn-primary text-xs" disabled={submittingSsl}>
                    {submittingSsl ? 'Đang gửi yêu cầu...' : 'Đăng ký & Cài đặt'}
                  </button>
                </div>
              </form>
            )}

            {sslMode === 'custom' && (
              <form onSubmit={handleInstallCustomSSL} className="card-glass p-5 rounded-lg space-y-4 text-sm max-w-xl border border-white/10">
                <h5 className="font-bold text-green-400">Cấu hình SSL Custom (Tự tải lên)</h5>
                
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Chọn hoặc nhập Tên miền cấu hình:</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="vd: mywebsite.com" 
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    className="input-glass w-full text-xs" 
                    list="ssl-site-domains"
                  />
                  <datalist id="ssl-site-domains">
                    {sites.map(s => <option key={s.domain} value={s.domain} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Nội dung Certificate (.crt / .pem / fullchain):</label>
                  <textarea 
                    required 
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" 
                    value={customCertText}
                    onChange={e => setCustomCertText(e.target.value)}
                    className="input-glass w-full font-mono text-xs" 
                    style={{ height: '120px' }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Nội dung Private Key (.key):</label>
                  <textarea 
                    required 
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" 
                    value={customKeyText}
                    onChange={e => setCustomKeyText(e.target.value)}
                    className="input-glass w-full font-mono text-xs" 
                    style={{ height: '120px' }}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" className="btn btn-primary text-xs" disabled={submittingSsl}>
                    {submittingSsl ? 'Đang cài đặt...' : 'Cài đặt Custom SSL'}
                  </button>
                </div>
              </form>
            )}
          </div>
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

      {/* Tab 5: Nginx Config Scanner */}
      {activeTab === 'scanner' && (
        <div className="space-y-5">
          {/* Header toolbar */}
          <div className="card-glass p-5 rounded-xl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: '#e2e8f0' }}>
                <ScanSearch size={20} style={{ color: '#818cf8' }} />
                Nginx Config Error Scanner
              </h3>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                Chạy lệnh <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '3px', color: '#a78bfa' }}>nginx -t</code> trực tiếp trên VPS và phân tích kết quả để phát hiện lỗi cú pháp cấu hình.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleScanNginx}
              disabled={scanning}
              style={{ minWidth: '140px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ScanSearch size={15} className={scanning ? 'animate-pulse' : ''} />
              {scanning ? 'Đang quét...' : 'Quét ngay'}
            </button>
          </div>

          {/* Loading state */}
          {scanning && (
            <div className="card-glass p-10 rounded-xl text-center" style={{ color: '#818cf8' }}>
              <ScanSearch size={32} className="animate-pulse mx-auto mb-3" style={{ opacity: 0.7 }} />
              <p className="text-sm">Đang kết nối SSH và chạy <code>nginx -t</code> trên VPS...</p>
            </div>
          )}

          {/* Scan results */}
          {!scanning && scanResult && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className="card-glass p-5 rounded-xl flex items-center gap-4"
                style={{
                  border: scanResult.passed ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                  background: scanResult.passed
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, transparent 100%)'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, transparent 100%)'
                }}
              >
                {scanResult.passed
                  ? <CheckCircle2 size={32} style={{ color: '#10b981', flexShrink: 0 }} />
                  : <XCircle size={32} style={{ color: '#ef4444', flexShrink: 0 }} />
                }
                <div style={{ flex: 1 }}>
                  <p className="font-bold text-sm" style={{ color: scanResult.passed ? '#34d399' : '#f87171' }}>
                    {scanResult.passed
                      ? '✅ Cấu hình Nginx hoàn toàn hợp lệ!'
                      : `❌ Phát hiện ${scanResult.errors.length} vấn đề trong cấu hình Nginx`
                    }
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                    {scanResult.passed
                      ? 'nginx -t chạy không có lỗi. Tất cả file cấu hình đều đúng cú pháp.'
                      : 'Nginx hiện đang hoạt động với cấu hình có lỗi tiềm ẩn. Hãy kiểm tra từng mục bên dưới.'
                    }
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="text-xs" style={{ color: '#6b7280' }}>Tổng files quét</div>
                  <div className="text-xl font-bold font-mono" style={{ color: '#818cf8' }}>{scanResult.allFiles?.length || 0}</div>
                </div>
              </div>

              {/* Error List */}
              {scanResult.errors.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold" style={{ color: '#e2e8f0' }}>
                    Danh sách vấn đề phát hiện ({scanResult.errors.length})
                  </h4>
                  {scanResult.errors.map((err, idx) => {
                    const fileKey = err.file;
                    const contextData = scanResult.errorDetails?.find(d => d.file === err.file);
                    const isExpanded = expandedFile === `${idx}`;
                    // Detect auto-fix type
                    const isMissingSemicolon = err.message?.toLowerCase().includes('unexpected') || err.message?.toLowerCase().includes('directive');
                    const isPhpSocket = err.message?.toLowerCase().includes('fastcgi') || err.message?.toLowerCase().includes('php') || err.message?.toLowerCase().includes('socket');
                    const isDuplicateDefault = err.message?.toLowerCase().includes('duplicate') || err.message?.toLowerCase().includes('default_server');

                    return (
                      <div
                        key={idx}
                        className="card-glass rounded-xl overflow-hidden"
                        style={{
                          border: err.severity === 'error'
                            ? '1px solid rgba(239,68,68,0.2)'
                            : '1px solid rgba(251,191,36,0.2)'
                        }}
                      >
                        {/* Error header */}
                        <div
                          className="p-4"
                          style={{
                            background: err.severity === 'error'
                              ? 'rgba(239,68,68,0.06)'
                              : 'rgba(251,191,36,0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            {err.severity === 'error'
                              ? <XCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: '2px' }} />
                              : <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded"
                                  style={{
                                    background: err.severity === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)',
                                    color: err.severity === 'error' ? '#fca5a5' : '#fde68a',
                                  }}
                                >
                                  {err.severity === 'error' ? 'EMERG' : 'WARN'}
                                </span>
                                {err.file && (
                                  <code className="text-xs" style={{ color: '#818cf8' }}>
                                    {err.file.split('/').pop()}
                                    {err.line && <span style={{ color: '#6b7280' }}>:{err.line}</span>}
                                  </code>
                                )}
                              </div>
                              <p className="text-sm font-mono" style={{ color: '#e2e8f0', wordBreak: 'break-word' }}>{err.message}</p>
                              {err.file && (
                                <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{err.file}</p>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                            {err.file && contextData && (
                              <button
                                className="btn btn-glass btn-xs"
                                onClick={() => setExpandedFile(isExpanded ? null : `${idx}`)}
                                style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {isExpanded ? 'Thu gọn' : 'Xem code context'}
                              </button>
                            )}
                            {isMissingSemicolon && err.file && (
                              <button
                                className="btn btn-xs"
                                onClick={() => handleFixNginx('add_semicolon', err.file, err.line)}
                                disabled={!!fixingIssue}
                                style={{
                                  fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px',
                                  background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)',
                                  borderRadius: '6px', cursor: fixingIssue ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <Wrench size={11} />
                                {fixingIssue === `${err.file}:add_semicolon` ? 'Đang sửa...' : 'Thêm dấu chấm phẩy'}
                              </button>
                            )}
                            {isPhpSocket && err.file && (
                              <button
                                className="btn btn-xs"
                                onClick={() => handleFixNginx('fix_php_socket', err.file, err.line)}
                                disabled={!!fixingIssue}
                                style={{
                                  fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px',
                                  background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)',
                                  borderRadius: '6px', cursor: fixingIssue ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <Wrench size={11} />
                                {fixingIssue === `${err.file}:fix_php_socket` ? 'Đang sửa...' : 'Sửa PHP-FPM socket'}
                              </button>
                            )}
                            {isDuplicateDefault && err.file && (
                              <button
                                className="btn btn-xs"
                                onClick={() => handleFixNginx('remove_duplicate_default', err.file, err.line)}
                                disabled={!!fixingIssue}
                                style={{
                                  fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px',
                                  background: 'rgba(245,158,11,0.15)', color: '#fde68a', border: '1px solid rgba(245,158,11,0.3)',
                                  borderRadius: '6px', cursor: fixingIssue ? 'not-allowed' : 'pointer'
                                }}
                              >
                                <Wrench size={11} />
                                {fixingIssue === `${err.file}:remove_duplicate_default` ? 'Đang sửa...' : 'Gỡ duplicate default'}
                              </button>
                            )}
                            <button
                              className="btn btn-xs"
                              onClick={() => handleFixNginx('reload_only', err.file || '/etc/nginx/nginx.conf', null)}
                              disabled={!!fixingIssue}
                              style={{
                                fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px',
                                background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '6px', cursor: fixingIssue ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <RotateCw size={11} />
                              Reload Nginx
                            </button>
                          </div>
                        </div>

                        {/* Expandable code context */}
                        {isExpanded && contextData && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <pre
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                padding: '16px',
                                margin: 0,
                                background: 'rgba(0,0,0,0.4)',
                                color: '#d1d5db',
                                overflowX: 'auto',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                lineHeight: 1.6
                              }}
                            >
                              {contextData.content.split('\n').map((line, li) => {
                                const lineNum = li + 1;
                                const isErrLine = err.line && Math.abs(lineNum - err.line) <= 1;
                                return (
                                  <div
                                    key={li}
                                    style={{
                                      background: isErrLine ? 'rgba(239,68,68,0.15)' : 'transparent',
                                      borderLeft: isErrLine ? '3px solid #ef4444' : '3px solid transparent',
                                      paddingLeft: '8px',
                                      borderRadius: '2px'
                                    }}
                                  >
                                    <span style={{ color: '#4b5563', userSelect: 'none', marginRight: '12px', minWidth: '30px', display: 'inline-block', textAlign: 'right' }}>
                                      {lineNum}
                                    </span>
                                    {line}
                                  </div>
                                );
                              })}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Raw nginx -t output */}
              <div className="card-glass p-4 rounded-xl">
                <h4 className="text-xs font-bold mb-2" style={{ color: '#6b7280' }}>
                  OUTPUT: <code style={{ color: '#a78bfa' }}>nginx -t</code> raw
                </h4>
                <pre
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: scanResult.passed ? '#34d399' : '#f87171',
                    background: 'rgba(0,0,0,0.35)',
                    padding: '12px',
                    borderRadius: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  {scanResult.rawOutput || '(Không có output)'}
                </pre>
              </div>

              {/* Config files list */}
              {scanResult.allFiles?.length > 0 && (
                <div className="card-glass p-4 rounded-xl">
                  <h4 className="text-xs font-bold mb-3" style={{ color: '#6b7280' }}>
                    FILES ĐƯỢC QUÉT ({scanResult.allFiles.length} files)
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {scanResult.allFiles.map((f, i) => {
                      const hasError = scanResult.errors.some(e => e.file === f);
                      return (
                        <span
                          key={i}
                          className="font-mono text-xs px-2 py-1 rounded"
                          style={{
                            background: hasError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                            color: hasError ? '#fca5a5' : '#6b7280',
                            border: hasError ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {hasError && '⚠ '}
                          {f.split('/').pop()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!scanning && !scanResult && (
            <div className="card-glass p-12 rounded-xl text-center" style={{ color: '#4b5563' }}>
              <ScanSearch size={40} className="mx-auto mb-3" style={{ opacity: 0.4 }} />
              <p className="text-sm">Nhấn nút <b style={{ color: '#818cf8' }}>Quét ngay</b> để phân tích cấu hình Nginx trên VPS.</p>
            </div>
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
                {type === 'php' && (
                  <div className="form-group">
                    <label>Phiên bản PHP (PHP Version)</label>
                    <select
                      value={phpVersion}
                      onChange={e => setPhpVersion(e.target.value)}
                      className="input-glass"
                    >
                      <option value="7.4">PHP 7.4</option>
                      <option value="8.0">PHP 8.0</option>
                      <option value="8.1">PHP 8.1</option>
                      <option value="8.2">PHP 8.2 (Khuyên dùng)</option>
                      <option value="8.3">PHP 8.3</option>
                      <option value="8.4">PHP 8.4</option>
                    </select>
                  </div>
                )}
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
      {/* Test SSL Auto-Renew Modal */}
      {showTestModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '700px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h2>Kết quả Chạy thử Gia hạn SSL Let's Encrypt (Dry Run)</h2>
              <button onClick={() => setShowTestModal(false)} className="modal-close-btn"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: '16px' }}>
              <p className="text-xs text-gray-400 mb-3">
                Tiến trình này đang giả lập lệnh `certbot renew --dry-run` để kiểm tra khả năng gia hạn thành công cho tất cả chứng chỉ mà không ảnh hưởng thực tế tới chứng chỉ hiện tại.
              </p>
              <pre className="bg-black/60 text-green-400 p-4 font-mono text-xs h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10">
                {renewTestLogs}
              </pre>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setShowTestModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
