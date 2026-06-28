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
  Lock,
  X,
  Bug,
  Cpu,
  Network,
  FileWarning,
  Clock,
  Zap,
  CheckCircle
} from 'lucide-react';

const UFW_PRESETS = [
  { name: 'Tùy chỉnh (Custom)', port: '', proto: 'tcp' },
  { name: 'Web Server (HTTP/HTTPS: 80, 443)', port: '80,443', proto: 'tcp' },
  { name: 'Database MySQL (3306)', port: '3306', proto: 'tcp' },
  { name: 'Database PostgreSQL (5432)', port: '5432', proto: 'tcp' },
  { name: 'FTP Server (20, 21)', port: '20,21', proto: 'tcp' },
  { name: 'Mail Server (SMTP/IMAP/POP3)', port: '25,143,993,110,995,465,587', proto: 'tcp' },
  { name: 'SSH (22)', port: '22', proto: 'tcp' }
];

export default function Security() {
  const { apiCall, showToast, currentVPS } = useVPS();
  const [activeTab, setActiveTab] = useState('firewall');
  const [loading, setLoading] = useState(false);

  // Tab 1: Firewall UFW State
  const [ufwActive, setUfwActive] = useState(false);
  const [ufwRules, setUfwRules] = useState([]);
  const [portInput, setPortInput] = useState('');
  const [protoInput, setProtoInput] = useState('tcp');
  const [actionInput, setActionInput] = useState('allow');
  const [fromIpInput, setFromIpInput] = useState('any');
  const [presetInput, setPresetInput] = useState('Tùy chỉnh (Custom)');

  // Tab 1.5: Fail2Ban State
  const [fail2banInstalled, setFail2banInstalled] = useState(false);
  const [fail2banActive, setFail2banActive] = useState(false);
  const [fail2banJails, setFail2banJails] = useState([]);
  const [fail2banConfig, setFail2banConfig] = useState({ ignoreip: '', bantime: '', findtime: '', maxretry: '' });
  const [selectedJail, setSelectedJail] = useState(null);
  const [manualBanIp, setManualBanIp] = useState('');
  const [fail2banSubTab, setFail2banSubTab] = useState('jails');
  const [rawF2bConfig, setRawF2bConfig] = useState('');
  const [rawF2bLoading, setRawF2bLoading] = useState(false);
  const [f2bConfigSaving, setF2bConfigSaving] = useState(false);
  const [serviceActionLoading, setServiceActionLoading] = useState(false);

  // Tab 2: Listening Ports State
  const [listeningPorts, setListeningPorts] = useState([]);
  const [portsLoading, setPortsLoading] = useState(false);

  // Tab 3: SSH Port State
  const [sshPortInput, setSshPortInput] = useState('');
  const [sshLoading, setSshLoading] = useState(false);
  const [disablingPassword, setDisablingPassword] = useState(false);
  const [loadingFail2ban, setLoadingFail2ban] = useState(false);

  // Tab 4: SSL Panel State
  const [sslDomain, setSslDomain] = useState('');
  const [sslEmail, setSslEmail] = useState('');
  const [sslLoading, setSslLoading] = useState(false);
  const [sslResult, setSslResult] = useState(null);

  // Tab 5: IP Blacklist State
  const [blacklistIPs, setBlacklistIPs] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [ipToBlock, setIpToBlock] = useState('');

  // Tab 6: Firewall Zones State
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneIps, setZoneIps] = useState('');
  const [zonePorts, setZonePorts] = useState('');
  const [zoneDescription, setZoneDescription] = useState('');

  // Tab 7: Threat Scanner State
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanTime, setScanTime] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  // Tab 8: Change Panel Password State
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'firewall' || activeTab === 'fail2ban') {
      fetchSecurityStatus();
    } else if (activeTab === 'ports') {
      fetchListeningPorts();
    } else if (activeTab === 'blacklist') {
      fetchBlacklistIPs();
    } else if (activeTab === 'zones') {
      fetchZones();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'fail2ban' && fail2banSubTab === 'raw') {
      fetchRawFail2BanConfig();
    }
  }, [activeTab, fail2banSubTab]);

  const fetchRawFail2BanConfig = async () => {
    setRawF2bLoading(true);
    try {
      const res = await apiCall('/api/security/fail2ban/config/raw/get', 'POST');
      if (res.success) {
        setRawF2bConfig(res.data);
      }
    } catch (err) {
      showToast('Lỗi tải cấu hình Fail2Ban: ' + err.message, 'error');
    } finally {
      setRawF2bLoading(false);
    }
  };

  const fetchZones = async () => {
    setZonesLoading(true);
    try {
      const res = await apiCall('/api/security/zones/list', 'POST');
      if (res.success) {
        setZones(res.data || []);
      }
    } catch (err) {
      showToast('Lỗi tải danh sách vùng bảo mật: ' + err.message, 'error');
    } finally {
      setZonesLoading(false);
    }
  };

  const handleOpenAddZone = () => {
    setEditingZone(null);
    setZoneName('');
    setZoneIps('');
    setZonePorts('');
    setZoneDescription('');
    setShowZoneModal(true);
  };

  const handleOpenEditZone = (zone) => {
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneIps(zone.ips.join(', '));
    setZonePorts(zone.ports.map(p => `${p.port}/${p.proto || 'any'}`).join(', '));
    setZoneDescription(zone.description);
    setShowZoneModal(true);
  };

  const handleSaveZone = async (e) => {
    e.preventDefault();
    if (!zoneName.trim()) return;

    const ips = zoneIps.split(',').map(ip => ip.trim()).filter(Boolean);
    const ports = zonePorts.split(',').map(p => {
      const parts = p.trim().split('/');
      const port = parts[0].trim();
      const proto = parts[1] ? parts[1].trim().toLowerCase() : 'any';
      return { port, proto };
    }).filter(p => p.port);

    try {
      const zonePayload = {
        id: editingZone ? editingZone.id : undefined,
        name: zoneName.trim(),
        ips,
        ports,
        description: zoneDescription.trim()
      };

      const res = await apiCall('/api/security/zones/save', 'POST', { zone: zonePayload });
      if (res.success) {
        showToast(res.message, 'success');
        setZones(res.data || []);
        setShowZoneModal(false);
      }
    } catch (err) {
      showToast('Lỗi lưu vùng bảo mật: ' + err.message, 'error');
    }
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa vùng bảo mật này không?')) return;
    try {
      const res = await apiCall('/api/security/zones/delete', 'POST', { id });
      if (res.success) {
        showToast(res.message, 'success');
        setZones(res.data || []);
      }
    } catch (err) {
      showToast('Lỗi xóa vùng bảo mật: ' + err.message, 'error');
    }
  };

  const handleApplyZones = async () => {
    if (!window.confirm('Cảnh báo: Áp dụng các vùng bảo mật sẽ dọn dẹp các quy tắc allow chung của các cổng được chỉ định để giới hạn truy cập. Bạn hãy đảm bảo IP hiện tại của mình đã được cho phép truy cập SSH trong các vùng. Tiếp tục?')) return;
    setLoading(true);
    try {
      const res = await apiCall('/api/security/zones/apply', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
        if (activeTab === 'firewall') {
          fetchSecurityStatus();
        }
      }
    } catch (err) {
      showToast('Lỗi áp dụng cấu hình: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityStatus = async () => {
    setLoading(true);
    try {
      const ufwRes = await apiCall('/api/security/ufw/status', 'POST');
      setUfwActive(ufwRes.data?.active || false);
      setUfwRules(ufwRes.data?.rules || []);

      const f2bRes = await apiCall('/api/security/fail2ban/status', 'POST');
      if (f2bRes.success) {
        setFail2banInstalled(f2bRes.data?.installed || false);
        setFail2banActive(f2bRes.data?.active || false);
        const jailsList = f2bRes.data?.jails || [];
        setFail2banJails(jailsList);
        setFail2banConfig(f2bRes.data?.config || { ignoreip: '', bantime: '', findtime: '', maxretry: '' });
        
        if (jailsList.length > 0) {
          if (!selectedJail || !jailsList.some(j => j.name === selectedJail.name)) {
            setSelectedJail(jailsList[0]);
          } else {
            const updatedSelected = jailsList.find(j => j.name === selectedJail.name);
            setSelectedJail(updatedSelected);
          }
        } else {
          setSelectedJail(null);
        }
      }
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
        proto: protoInput,
        action: actionInput,
        fromIP: fromIpInput
      });
      showToast(`Đã thêm quy tắc UFW thành công`, 'success');
      setPortInput('');
      setFromIpInput('any');
      setActionInput('allow');
      setPresetInput('Tùy chỉnh (Custom)');
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

  const handleInstallFail2Ban = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn cài đặt và kích hoạt Fail2Ban trên VPS không?')) return;
    setLoadingFail2ban(true);
    showToast('Đang chạy tiến trình cài đặt Fail2Ban...', 'info');
    try {
      const res = await apiCall('/api/security/fail2ban/install', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
        fetchSecurityStatus();
      }
    } catch (err) {
      showToast('Cài đặt Fail2Ban thất bại: ' + err.message, 'error');
    } finally {
      setLoadingFail2ban(false);
    }
  };

  const handleDisablePasswordLogin = async () => {
    const confirmMsg = `CẢNH BÁO NGUY HIỂM:\n\n` +
      `1. Thao tác này sẽ tắt tính năng đăng nhập SSH bằng mật khẩu thông thường.\n` +
      `2. Bạn CHỈ có thể đăng nhập bằng SSH Key sau khi tắt mật khẩu.\n` +
      `3. Hãy chắc chắn bạn đã cấu hình SSH Key hợp lệ và đăng nhập thử thành công trước khi thực hiện. Nếu không bạn sẽ bị KHÓA KHỎI VPS.\n\n` +
      `Bạn chắc chắn đã sẵn sàng và muốn vô hiệu hóa mật khẩu?`;
    
    if (!window.confirm(confirmMsg)) return;

    setDisablingPassword(true);
    showToast('Đang tiến hành vô hiệu hóa đăng nhập bằng mật khẩu...', 'info');
    try {
      const res = await apiCall('/api/security/ssh/password-disable', 'POST');
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (err) {
      showToast('Thao tác thất bại: ' + err.message, 'error');
    } finally {
      setDisablingPassword(false);
    }
  };

  const handleSaveFail2BanConfig = async (e) => {
    e.preventDefault();
    setF2bConfigSaving(true);
    try {
      const res = await apiCall('/api/security/fail2ban/config/save', 'POST', {
        ignoreip: fail2banConfig.ignoreip,
        bantime: fail2banConfig.bantime,
        findtime: fail2banConfig.findtime,
        maxretry: fail2banConfig.maxretry
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchSecurityStatus();
      }
    } catch (err) {
      showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
    } finally {
      setF2bConfigSaving(false);
    }
  };

  const handleSaveRawFail2BanConfig = async (e) => {
    e.preventDefault();
    setF2bConfigSaving(true);
    try {
      const res = await apiCall('/api/security/fail2ban/config/raw/save', 'POST', {
        content: rawF2bConfig
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchSecurityStatus();
      }
    } catch (err) {
      showToast('Lỗi lưu cấu hình thô: ' + err.message, 'error');
    } finally {
      setF2bConfigSaving(false);
    }
  };

  const handleUnbanIP = async (jailName, ipAddress) => {
    if (!window.confirm(`Bạn có chắc muốn gỡ chặn IP ${ipAddress} khỏi Jail ${jailName}?`)) return;
    try {
      showToast(`Đang gỡ chặn IP ${ipAddress}...`, 'info');
      const res = await apiCall('/api/security/fail2ban/unban', 'POST', {
        jail: jailName,
        ip: ipAddress
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchSecurityStatus();
      }
    } catch (err) {
      showToast('Gỡ chặn thất bại: ' + err.message, 'error');
    }
  };

  const handleManualBanIP = async (e) => {
    e.preventDefault();
    if (!selectedJail || !manualBanIp.trim()) return;
    try {
      showToast(`Đang thực hiện chặn IP ${manualBanIp} trong Jail ${selectedJail.name}...`, 'info');
      const res = await apiCall('/api/security/fail2ban/ban', 'POST', {
        jail: selectedJail.name,
        ip: manualBanIp.trim()
      });
      if (res.success) {
        showToast(res.message, 'success');
        setManualBanIp('');
        fetchSecurityStatus();
      }
    } catch (err) {
      showToast('Chặn IP thất bại: ' + err.message, 'error');
    }
  };

  const handleControlFail2Ban = async (action) => {
    const actionLabel = action === 'start' ? 'khởi động' : action === 'stop' ? 'dừng' : 'khởi động lại';
    if (action === 'stop' && !window.confirm('Cảnh báo: Dừng Fail2Ban sẽ vô hiệu hóa tính năng bảo vệ dò quét mật khẩu. Bạn có chắc chắn muốn tiếp tục?')) return;
    
    setServiceActionLoading(true);
    try {
      showToast(`Đang gửi yêu cầu ${actionLabel} Fail2Ban...`, 'info');
      const res = await apiCall('/api/security/fail2ban/control', 'POST', { action });
      if (res.success) {
        showToast(res.message, 'success');
        fetchSecurityStatus();
      }
    } catch (err) {
      showToast(`Lỗi ${actionLabel} Fail2Ban: ` + err.message, 'error');
    } finally {
      setServiceActionLoading(false);
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

  const handleChangePanelPassword = async (e) => {
    e.preventDefault();
    if (!currentPw.trim() || !newPw.trim() || !confirmPw.trim()) return;

    if (newPw !== confirmPw) {
      showToast('Mật khẩu xác nhận không khớp', 'warning');
      return;
    }

    if (newPw.length < 6) {
      showToast('Mật khẩu mới phải từ 6 ký tự trở lên', 'warning');
      return;
    }

    setPwLoading(true);
    try {
      const res = await apiCall('/api/auth/change-password', 'POST', {
        currentPassword: currentPw,
        newPassword: newPw
      });
      if (res.success) {
        showToast(res.message || 'Thay đổi mật khẩu Panel thành công!', 'success');
        if (res.token) {
          localStorage.setItem('vps_panel_token', res.token);
        }
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      }
    } catch (err) {
      showToast(err.message || 'Đổi mật khẩu thất bại', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const fetchBlacklistIPs = async () => {
    setBlacklistLoading(true);
    try {
      const res = await apiCall('/api/security/blacklist/list', 'POST');
      if (res.success) {
        setBlacklistIPs(res.data?.ips || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải danh sách IP bị chặn: ' + err.message, 'error');
    } finally {
      setBlacklistLoading(false);
    }
  };

  const handleBlockIP = async (e) => {
    e.preventDefault();
    if (!ipToBlock.trim()) return;
    setBlacklistLoading(true);
    try {
      const res = await apiCall('/api/security/blacklist/block', 'POST', { ip: ipToBlock });
      if (res.success) {
        showToast(res.message || `Đã chặn IP ${ipToBlock} thành công`, 'success');
        setIpToBlock('');
        fetchBlacklistIPs();
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi chặn IP: ' + err.message, 'error');
    } finally {
      setBlacklistLoading(false);
    }
  };

  const handleUnblockIP = async (ip) => {
    if (!window.confirm(`Bạn có chắc muốn gỡ chặn IP ${ip}?`)) return;
    setBlacklistLoading(true);
    try {
      const res = await apiCall('/api/security/blacklist/unblock', 'POST', { ip });
      if (res.success) {
        showToast(res.message || `Đã gỡ chặn IP ${ip} thành công`, 'success');
        fetchBlacklistIPs();
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi gỡ chặn IP: ' + err.message, 'error');
    } finally {
      setBlacklistLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight font-outfit">Bảo mật hệ thống</h1>
          <p className="text-sm text-gray-400">Giám sát tường lửa, rà soát cổng mạng, cấu hình Fail2Ban, bảo mật SSH và chứng chỉ SSL Panel</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="db-tabs-container card-glass p-1.5 flex gap-2 rounded-xl">
        <button 
          onClick={() => setActiveTab('firewall')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'firewall' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Shield size={16} />
          Tường lửa UFW
        </button>
        <button 
          onClick={() => setActiveTab('fail2ban')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'fail2ban' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <ShieldAlert size={16} />
          Bảo vệ Fail2Ban
        </button>
        <button 
          onClick={() => setActiveTab('ports')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'ports' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Activity size={16} />
          Cổng kết nối (Ports)
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
        <button 
          onClick={() => setActiveTab('blacklist')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'blacklist' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <ShieldAlert size={16} className="text-red-400" />
          Blacklist IP
        </button>
        <button 
          onClick={() => setActiveTab('zones')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'zones' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Shield size={16} className="text-yellow-400" />
          Vùng bảo mật (Zones)
        </button>
        <button 
          onClick={() => setActiveTab('scanner')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'scanner' ? 'active bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Bug size={16} className="text-red-400" />
          Quét Mã Độc
        </button>
        <button 
          onClick={() => setActiveTab('password')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'password' ? 'active bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
        >
          <Lock size={16} className="text-indigo-400" />
          Mật khẩu Panel
        </button>
      </div>

      {/* TAB 1: Firewall UFW */}
      {activeTab === 'firewall' && (
        <div className="space-y-6">
          <div className="card-glass p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1 text-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={22} className={ufwActive ? 'text-green-400' : 'text-red-400'} />
                <h2 className="text-lg font-bold">Tường lửa UFW</h2>
                <span className={`status-badge ${ufwActive ? 'success' : 'danger'}`}>
                  {ufwActive ? 'Đang hoạt động' : 'Tắt'}
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">UFW (Uncomplicated Firewall) giúp quản lý lưu lượng mạng ra vào và chặn các cổng truy cập trái phép trên VPS.</p>
            </div>
            <button
              onClick={toggleUFW}
              className={`btn ${ufwActive ? 'btn-danger' : 'btn-success'} whitespace-nowrap`}
              style={{ padding: '10px 20px' }}
            >
              <Power size={16} />
              {ufwActive ? 'Vô hiệu hóa Tường lửa' : 'Kích hoạt Tường lửa'}
            </button>
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
                        {ufwRules.map((rule) => {
                          const actionUpper = rule.action.toUpperCase();
                          let badgeClass = 'danger';
                          if (actionUpper === 'ALLOW') badgeClass = 'success';
                          else if (actionUpper === 'LIMIT') badgeClass = 'warning';
                          
                          return (
                            <tr key={rule.index}>
                              <td className="font-mono text-xs text-gray-400">#{rule.index}</td>
                              <td className="font-semibold text-indigo-300">{rule.to}</td>
                              <td>
                                <span className={`status-badge ${badgeClass}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                  {rule.action}
                                </span>
                              </td>
                              <td className="text-gray-300 font-mono text-xs">{rule.from}</td>
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Rule Form */}
              <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Plus size={18} className="text-green-400" />
                  Thêm luật Tường lửa
                </h3>
                <form onSubmit={handleAddRule} className="space-y-4">
                  <div className="form-group">
                    <label>Hành động (Action)</label>
                    <select
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      className="input-glass"
                    >
                      <option value="allow">ALLOW (Cho phép)</option>
                      <option value="deny">DENY (Chặn cổng)</option>
                      <option value="limit">LIMIT (Giới hạn - chống Brute force)</option>
                      <option value="reject">REJECT (Từ chối kết nối)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Quy tắc mẫu (Preset)</label>
                    <select
                      value={presetInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPresetInput(val);
                        const found = UFW_PRESETS.find(p => p.name === val);
                        if (found) {
                          setPortInput(found.port);
                          setProtoInput(found.proto);
                        }
                      }}
                      className="input-glass"
                    >
                      {UFW_PRESETS.map((p, idx) => (
                        <option key={idx} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Cổng dịch vụ (Port)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: 80, 443 hoặc any"
                      value={portInput}
                      onChange={(e) => setPortInput(e.target.value)}
                      className="input-glass font-mono text-sm"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Hỗ trợ nhiều cổng cách nhau bằng dấu phẩy. VD: `80,443,3000`</p>
                  </div>

                  <div className="form-group">
                    <label>Giao thức (Protocol)</label>
                    <select
                      value={protoInput}
                      onChange={(e) => setProtoInput(e.target.value)}
                      className="input-glass"
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                      <option value="any">Bất kỳ (TCP & UDP)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>IP / Subnet nguồn (Source IP)</label>
                    <input
                      type="text"
                      required
                      placeholder="Mặc định: any (Tất cả mọi IP)"
                      value={fromIpInput}
                      onChange={(e) => setFromIpInput(e.target.value)}
                      className="input-glass font-mono text-xs"
                    />
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Ví dụ: `any` (mọi IP) hoặc giới hạn chỉ IP `1.2.3.4` hoặc dải mạng `192.168.1.0/24` được phép truy cập.</p>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success btn-block"
                    style={{ padding: '10px' }}
                  >
                    <Plus size={14} />
                    Áp dụng luật mới
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1.5: Fail2Ban */}
      {activeTab === 'fail2ban' && (
        <div className="space-y-6">
          {/* Header & Service Actions */}
          <div className="card-glass p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1 text-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} className={fail2banActive ? 'text-green-400' : 'text-yellow-400'} />
                <h2 className="text-lg font-bold">Dịch vụ chống brute-force Fail2Ban</h2>
                <span className={`status-badge ${!fail2banInstalled ? 'danger' : fail2banActive ? 'success' : 'warning'}`}>
                  {!fail2banInstalled ? 'Chưa cài đặt' : fail2banActive ? 'Đang hoạt động' : 'Tắt'}
                </span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">Tự động phát hiện và chặn tạm thời hoặc vĩnh viễn các địa chỉ IP Brute force thông qua các tệp nhật ký đăng nhập.</p>
            </div>
            
            {!fail2banInstalled ? (
              <button
                onClick={handleInstallFail2Ban}
                disabled={loadingFail2ban}
                className="btn btn-success whitespace-nowrap"
                style={{ padding: '10px 20px' }}
              >
                {loadingFail2ban ? 'Đang cài đặt...' : 'Cài đặt & Kích hoạt'}
              </button>
            ) : (
              <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
                {fail2banActive ? (
                  <button
                    onClick={() => handleControlFail2Ban('stop')}
                    disabled={serviceActionLoading}
                    className="btn btn-danger btn-sm flex items-center gap-1.5"
                  >
                    <Power size={14} /> Dừng
                  </button>
                ) : (
                  <button
                    onClick={() => handleControlFail2Ban('start')}
                    disabled={serviceActionLoading}
                    className="btn btn-success btn-sm flex items-center gap-1.5"
                  >
                    <Power size={14} /> Bật
                  </button>
                )}
                <button
                  onClick={() => handleControlFail2Ban('restart')}
                  disabled={serviceActionLoading}
                  className="btn btn-glass btn-sm flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={serviceActionLoading ? 'animate-spin' : ''} /> Khởi động lại
                </button>
              </div>
            )}
          </div>

          {fail2banInstalled && fail2banActive && (
            <div className="space-y-6">
              {/* Fail2Ban Sub Tabs */}
              <div className="flex border-b border-white/5 gap-4" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: '16px' }}>
                <button
                  onClick={() => setFail2banSubTab('jails')}
                  className={`py-2 px-1 text-sm font-semibold border-b-2 transition-all ${fail2banSubTab === 'jails' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  Giám sát Jails & Banned IPs
                </button>
                <button
                  onClick={() => setFail2banSubTab('settings')}
                  className={`py-2 px-1 text-sm font-semibold border-b-2 transition-all ${fail2banSubTab === 'settings' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  Cấu hình tham số
                </button>
                <button
                  onClick={() => setFail2banSubTab('raw')}
                  className={`py-2 px-1 text-sm font-semibold border-b-2 transition-all ${fail2banSubTab === 'raw' ? 'border-indigo-500 text-indigo-300' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                  Cấu hình jail.local thô
                </button>
              </div>

              {/* Sub-tab 1: Jails Monitoring */}
              {fail2banSubTab === 'jails' && (
                <div className="db-layout-container">
                  {/* Left Column: Jails List */}
                  <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Server size={18} className="text-indigo-400" />
                      Danh sách Jails
                    </h3>
                    <p className="text-xs text-gray-400">Chọn một Jail để xem chi tiết và danh sách IP bị chặn.</p>
                    
                    {fail2banJails.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">Không có Jail hoạt động nào.</p>
                    ) : (
                      <div className="space-y-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {fail2banJails.map(jail => (
                          <button
                            key={jail.name}
                            onClick={() => setSelectedJail(jail)}
                            className={`w-full p-3 rounded-lg text-left transition-all border text-sm flex justify-between items-center ${selectedJail?.name === jail.name ? 'bg-indigo-500/10 border-indigo-500/30 text-white font-semibold' : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'}`}
                          >
                            <span className="font-mono">{jail.name}</span>
                            <span className="status-badge danger" style={{ fontSize: '10px', padding: '1px 6px' }}>
                              {jail.currentlyBanned} blocked
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Banned IP List */}
                  <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
                    {selectedJail ? (
                      <div className="space-y-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <ShieldAlert size={18} className="text-red-400" />
                            Jail: <span className="font-mono text-indigo-300">{selectedJail.name}</span>
                          </h3>
                          <span className="text-xs text-gray-400">
                            Total banned: {selectedJail.totalBanned} | Bị chặn hiện tại: {selectedJail.currentlyBanned}
                          </span>
                        </div>

                        {/* Ban IP Manual Form */}
                        <form onSubmit={handleManualBanIP} className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            required
                            placeholder="Nhập IP để chặn thủ công trong jail này"
                            value={manualBanIp}
                            onChange={(e) => setManualBanIp(e.target.value)}
                            className="input-glass flex-grow font-mono text-sm"
                            style={{ flexGrow: 1, padding: '8px' }}
                          />
                          <button type="submit" className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={14} /> Chặn IP
                          </button>
                        </form>

                        {/* List of currently banned IPs in this Jail */}
                        {selectedJail.bannedIPs.length === 0 ? (
                          <p className="text-sm text-gray-400 py-8 text-center font-normal">Jail này hiện không chặn IP nào.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="explorer-list-table">
                              <thead>
                                <tr>
                                  <th>Địa chỉ IP bị chặn</th>
                                  <th style={{ textAlign: 'center', width: '120px' }}>Hành động</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedJail.bannedIPs.map(ip => (
                                  <tr key={ip}>
                                    <td className="font-mono text-sm font-semibold text-red-300">{ip}</td>
                                    <td style={{ textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleUnbanIP(selectedJail.name, ip)}
                                        className="btn btn-glass btn-xs text-green-400 hover:text-green-300"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                      >
                                        Gỡ chặn (Unban)
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-12 text-center">Vui lòng chọn một Jail từ danh sách bên trái.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Settings parameters */}
              {fail2banSubTab === 'settings' && (
                <div className="card-glass p-6 rounded-xl max-w-2xl mx-auto space-y-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Server size={18} className="text-indigo-400" />
                    Cấu hình tham số Fail2Ban [DEFAULT]
                  </h3>
                  <form onSubmit={handleSaveFail2BanConfig} className="space-y-4">
                    <div className="form-group">
                      <label>Danh sách IP loại trừ (ignoreip)</label>
                      <input
                        type="text"
                        required
                        value={fail2banConfig.ignoreip}
                        onChange={(e) => setFail2banConfig({ ...fail2banConfig, ignoreip: e.target.value })}
                        className="input-glass font-mono text-xs"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        Các IP hoặc subnet cách nhau bằng khoảng trắng sẽ không bao giờ bị chặn. Ví dụ: `127.0.0.1/8 ::1 1.2.3.4`.
                      </p>
                    </div>

                    <div className="grid-2">
                      <div className="form-group">
                        <label>Thời gian chặn (bantime)</label>
                        <input
                          type="text"
                          required
                          value={fail2banConfig.bantime}
                          onChange={(e) => setFail2banConfig({ ...fail2banConfig, bantime: e.target.value })}
                          className="input-glass font-mono"
                          placeholder="Ví dụ: 10m hoặc 1d"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Thời gian khóa IP. Định dạng: `m` (phút), `h` (giờ), `d` (ngày).</p>
                      </div>

                      <div className="form-group">
                        <label>Chu kỳ theo dõi (findtime)</label>
                        <input
                          type="text"
                          required
                          value={fail2banConfig.findtime}
                          onChange={(e) => setFail2banConfig({ ...fail2banConfig, findtime: e.target.value })}
                          className="input-glass font-mono"
                          placeholder="Ví dụ: 10m"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Thời gian theo dõi số lần đăng nhập sai.</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Số lần thử tối đa (maxretry)</label>
                      <input
                        type="number"
                        required
                        value={fail2banConfig.maxretry}
                        onChange={(e) => setFail2banConfig({ ...fail2banConfig, maxretry: e.target.value })}
                        className="input-glass font-mono"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Số lần đăng nhập sai tối đa trong chu kỳ `findtime` trước khi bị khóa.</p>
                    </div>

                    <button type="submit" disabled={f2bConfigSaving} className="btn btn-primary btn-block" style={{ padding: '10px' }}>
                      {f2bConfigSaving ? 'Đang lưu cấu hình...' : 'Lưu Cấu Hình & Tải lại Fail2Ban'}
                    </button>
                  </form>
                </div>
              )}

              {/* Sub-tab 3: Raw config editor */}
              {fail2banSubTab === 'raw' && (
                <div className="card-glass p-6 rounded-xl space-y-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Server size={18} className="text-indigo-400" />
                        Trình chỉnh sửa thô jail.local
                      </h3>
                      <p className="text-xs text-gray-400">Cấu hình trực tiếp file `/etc/fail2ban/jail.local`. Cần đảm bảo đúng cú pháp INI.</p>
                    </div>
                    <button type="button" onClick={fetchRawFail2BanConfig} disabled={rawF2bLoading} className="btn btn-glass btn-sm flex items-center gap-1">
                      <RefreshCw size={14} className={rawF2bLoading ? 'animate-spin' : ''} /> Quét lại
                    </button>
                  </div>

                  {rawF2bLoading ? (
                    <div className="py-12 flex justify-center">
                      <span className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <form onSubmit={handleSaveRawFail2BanConfig} className="space-y-4">
                      <textarea
                        required
                        rows={22}
                        value={rawF2bConfig}
                        onChange={(e) => setRawF2bConfig(e.target.value)}
                        className="w-full bg-[#111] text-[#0f0] font-mono text-xs p-4 rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500"
                        style={{ lineHeight: '1.5' }}
                      />
                      <button type="submit" disabled={f2bConfigSaving} className="btn btn-primary btn-block" style={{ padding: '10px' }}>
                        {f2bConfigSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Thô & Reload Fail2Ban'}
                      </button>
                    </form>
                  )}
                </div>
              )}
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
          <div className="space-y-6">
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

            {/* SSH Password Login Hardening */}
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-yellow-400">
                <Lock size={18} />
                Vô hiệu hóa Đăng nhập bằng Mật khẩu
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tắt tính năng xác thực bằng mật khẩu để ngăn chặn hoàn toàn các cuộc tấn công Brute-force. Bạn **chỉ** có thể kết nối vào máy chủ sử dụng **SSH Keys** (Khóa công khai) đã cài trước đó.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleDisablePasswordLogin}
                  disabled={disablingPassword}
                  className="btn btn-warning btn-block flex items-center justify-center gap-2"
                  style={{ padding: '10px' }}
                >
                  {disablingPassword ? 'Đang áp dụng...' : 'Vô hiệu hóa Mật khẩu SSH'}
                </button>
              </div>
            </div>
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

      {/* TAB 5: IP Blacklist */}
      {activeTab === 'blacklist' && (
        <div className="db-layout-container">
          {/* Blacklisted IPs List */}
          <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-400" />
              Địa chỉ IP đang bị chặn (Firewall Blacklist)
            </h3>
            <p className="text-sm text-gray-400 font-normal">
              Các địa chỉ IP dưới đây sẽ bị chặn toàn bộ lưu lượng truy cập đi vào VPS thông qua tường lửa UFW.
            </p>

            {blacklistLoading && blacklistIPs.length === 0 ? (
              <div className="py-12 flex justify-center">
                <span className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : blacklistIPs.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center font-normal">Chưa chặn địa chỉ IP nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="explorer-list-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Quy tắc</th>
                      <th>IP / Khối mạng</th>
                      <th>Cổng đích (To)</th>
                      <th style={{ textAlign: 'center', width: '100px' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklistIPs.map((item) => (
                      <tr key={item.index}>
                        <td className="font-mono text-xs text-gray-400">#{item.index}</td>
                        <td className="font-mono font-semibold text-red-300">{item.ip}</td>
                        <td className="text-gray-300 text-xs">{item.to}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleUnblockIP(item.ip)}
                            className="btn btn-glass btn-xs text-green-400 hover:text-green-300"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            Gỡ chặn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Block IP Form */}
          <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Plus size={18} className="text-red-400" />
              Chặn địa chỉ IP mới
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-normal">
              Nhập IP hoặc dải IP (CIDR) để chặn ngay lập tức.
            </p>
            <form onSubmit={handleBlockIP} className="space-y-4">
              <div className="form-group">
                <label>Địa chỉ IP cần chặn</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 192.168.1.100 hoặc 1.2.3.4"
                  value={ipToBlock}
                  onChange={(e) => setIpToBlock(e.target.value)}
                  className="input-glass"
                />
              </div>

              <button
                type="submit"
                disabled={blacklistLoading}
                className="btn btn-danger btn-block"
                style={{ padding: '10px' }}
              >
                <Power size={14} />
                Áp dụng Chặn IP
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 6: Firewall Security Zones */}
      {activeTab === 'zones' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="text-lg font-bold text-gray-200">Phân vùng bảo mật Firewall (Security Zones)</h2>
              <p className="text-xs text-gray-400">Định nghĩa các vùng truy cập an toàn (vd: nhóm IP của dev được kết nối SSH, nhóm IP của webserver được kết nối MySQL).</p>
            </div>
            <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleApplyZones} className="btn btn-glass text-yellow-400 hover:bg-yellow-400/10">
                <RefreshCw size={14} className="animate-pulse" /> Áp dụng cấu hình
              </button>
              <button onClick={handleOpenAddZone} className="btn btn-primary">
                <Plus size={14} /> Thêm vùng mới
              </button>
            </div>
          </div>

          {zonesLoading ? (
            <div className="text-center py-12 text-gray-400">Đang quét danh sách vùng bảo mật trên VPS...</div>
          ) : zones.length === 0 ? (
            <div className="card-glass p-12 text-center text-gray-400 rounded-xl">
              Chưa có vùng bảo mật nào được cấu hình. Nhấp "Thêm vùng mới" để bắt đầu.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {zones.map(zone => (
                <div key={zone.id} className="card-glass p-5 rounded-xl space-y-4 border border-white/5 relative flex flex-col justify-between" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 className="font-semibold text-gray-200 text-sm flex items-center gap-1.5" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Shield size={16} className="text-yellow-400" />
                          {zone.name}
                        </h3>
                        <p className="text-xs text-gray-400 font-normal">{zone.description || 'Không có mô tả'}</p>
                      </div>
                      <div className="flex gap-1" style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => handleOpenEditZone(zone)} className="btn btn-glass btn-xs text-blue-300" style={{ padding: '2px 6px', fontSize: '11px' }}>Sửa</button>
                        <button onClick={() => handleDeleteZone(zone.id)} className="btn btn-glass btn-xs text-red-400" style={{ padding: '2px 6px', fontSize: '11px' }}>Xóa</button>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-white/5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Cổng kết nối được mở:</span>
                        <div className="flex flex-wrap gap-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {zone.ports.map((p, idx) => (
                            <span key={idx} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/10 rounded px-1.5 py-0.5 text-[10px] font-mono">
                              {p.port}/{p.proto || 'any'}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: '8px' }}>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">Địa chỉ IP an toàn:</span>
                        <div className="flex flex-wrap gap-1" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {zone.ips.map((ip, idx) => (
                            <span key={idx} className="bg-green-500/10 text-green-400 border border-green-500/10 rounded px-1.5 py-0.5 text-[10px] font-mono">
                              {ip}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Add/Edit Firewall Security Zone */}
      {showZoneModal && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4" style={{ width: '400px', maxWidth: '90%' }}>
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 className="text-lg font-bold text-gray-200">
                {editingZone ? 'Cập nhật Vùng bảo mật' : 'Thêm Vùng bảo mật mới'}
              </h2>
              <button onClick={() => setShowZoneModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-4 text-sm" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Tên vùng:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Dev Team, Web Servers..."
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px', width: '100%' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Danh sách IP an toàn (phân cách bằng dấu phẩy):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 1.2.3.4, 5.6.7.8"
                  value={zoneIps}
                  onChange={(e) => setZoneIps(e.target.value)}
                  className="input-glass w-full font-mono text-xs"
                  style={{ padding: '8px', width: '100%' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Các cổng được truy cập (e.g. 22/tcp, 3306/tcp, 3000):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 22/tcp, 3306/tcp, 3000"
                  value={zonePorts}
                  onChange={(e) => setZonePorts(e.target.value)}
                  className="input-glass w-full font-mono text-xs"
                  style={{ padding: '8px', width: '100%' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Mô tả chi tiết:</label>
                <textarea
                  placeholder="VD: Nhóm máy chủ chạy frontend..."
                  value={zoneDescription}
                  onChange={(e) => setZoneDescription(e.target.value)}
                  className="input-glass w-full text-xs"
                  style={{ padding: '8px', height: '60px', width: '100%' }}
                />
              </div>

              <div className="modal-footer pt-3 border-t border-white/10 flex justify-end gap-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                <button type="button" className="btn btn-glass" onClick={() => setShowZoneModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 7: Threat Scanner */}
      {activeTab === 'scanner' && (() => {
        const RISK_STYLES = {
          critical: { bg: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', badge: '#ef4444', label: '🔴 Nghiêm trọng' },
          high:     { bg: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', badge: '#f97316', label: '🟠 Nguy hiểm' },
          medium:   { bg: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', badge: '#eab308', label: '🟡 Cảnh báo' },
        };

        const handleScan = async () => {
          setScanLoading(true);
          setScanResult(null);
          try {
            const res = await apiCall('/api/security/scan/threats', 'POST');
            if (res.success) {
              setScanResult(res.data);
              setScanTime(new Date().toLocaleTimeString('vi-VN'));
              const total = res.totalThreats;
              showToast(total === 0 ? '✅ Hệ thống sạch, không phát hiện mối đe dọa!' : `⚠️ Phát hiện ${total} mối đe dọa!`, total === 0 ? 'success' : 'error');
            }
          } catch (err) { showToast('Lỗi quét: ' + err.message, 'error'); }
          finally { setScanLoading(false); }
        };

        const handleKill = async (pid) => {
          setActionLoading(p => ({ ...p, [`kill_${pid}`]: true }));
          try {
            const res = await apiCall('/api/security/scan/kill', 'POST', { pid });
            showToast(res.message || (res.success ? 'Đã diệt tiến trình!' : 'Thất bại'), res.success ? 'success' : 'error');
            if (res.success) setScanResult(prev => ({ ...prev, processes: prev.processes.filter(p => p.pid !== pid) }));
          } catch (err) { showToast(err.message, 'error'); }
          finally { setActionLoading(p => ({ ...p, [`kill_${pid}`]: false })); }
        };

        const handleDeleteFile = async (path) => {
          setActionLoading(p => ({ ...p, [`file_${path}`]: true }));
          try {
            const res = await apiCall('/api/security/scan/delete-file', 'POST', { path });
            showToast(res.message || (res.success ? 'Đã xóa file!' : 'Thất bại'), res.success ? 'success' : 'error');
            if (res.success) setScanResult(prev => ({ ...prev, files: prev.files.filter(f => f.path !== path) }));
          } catch (err) { showToast(err.message, 'error'); }
          finally { setActionLoading(p => ({ ...p, [`file_${path}`]: false })); }
        };

        const handleCleanCron = async (source, lineNum) => {
          setActionLoading(p => ({ ...p, [`cron_${lineNum}`]: true }));
          try {
            const res = await apiCall('/api/security/scan/clean-cron', 'POST', { source, lineNum });
            showToast(res.message || (res.success ? 'Đã xóa cronjob!' : 'Thất bại'), res.success ? 'success' : 'error');
            if (res.success) setScanResult(prev => ({ ...prev, cronjobs: prev.cronjobs.filter(c => !(c.source === source && c.lineNum === lineNum)) }));
          } catch (err) { showToast(err.message, 'error'); }
          finally { setActionLoading(p => ({ ...p, [`cron_${lineNum}`]: false })); }
        };

        const totalThreats = scanResult ? (scanResult.processes.length + scanResult.cronjobs.length + scanResult.network.length + scanResult.files.length) : 0;

        return (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="card-glass p-6 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.05))' }}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Bug size={24} className="text-red-400" />
                    <h2 className="text-xl font-bold">Bộ quét Mã Độc & Bot</h2>
                    {scanResult && (
                      <span className="status-badge" style={{ background: totalThreats > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: totalThreats > 0 ? '#f87171' : '#34d399', border: `1px solid ${totalThreats > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                        {totalThreats > 0 ? `⚠️ ${totalThreats} mối đe dọa` : '✅ Sạch'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">Quét toàn diện tiến trình, cronjob, kết nối mạng và file thực thi để phát hiện mã độc đào coin, bot và backdoor.</p>
                  {scanTime && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Clock size={12} /> Lần quét cuối: {scanTime}</p>}
                </div>
                <button
                  onClick={handleScan}
                  disabled={scanLoading}
                  className="btn whitespace-nowrap"
                  style={{ background: scanLoading ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', padding: '12px 28px', fontWeight: 700, boxShadow: scanLoading ? 'none' : '0 4px 20px rgba(239,68,68,0.4)' }}
                >
                  {scanLoading ? (
                    <><RefreshCw size={16} className="animate-spin" /> Đang quét...</>
                  ) : (
                    <><Zap size={16} /> Bắt đầu Quét ngay</>
                  )}
                </button>
              </div>

              {/* Stat summary */}
              {scanResult && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
                  {[
                    { icon: <Cpu size={16} />, label: 'Tiến trình', count: scanResult.processes.length, color: '#ef4444' },
                    { icon: <Clock size={16} />, label: 'Cronjob', count: scanResult.cronjobs.length, color: '#f97316' },
                    { icon: <Network size={16} />, label: 'Kết nối mạng', count: scanResult.network.length, color: '#a855f7' },
                    { icon: <FileWarning size={16} />, label: 'File thực thi', count: scanResult.files.length, color: '#eab308' },
                  ].map((s, i) => (
                    <div key={i} className="card-glass rounded-lg p-3 text-center">
                      <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: s.count > 0 ? s.color : '#34d399' }}>{s.count}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!scanResult && !scanLoading && (
              <div className="card-glass p-12 rounded-xl text-center">
                <Bug size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-400 mb-2">Chưa có kết quả quét</h3>
                <p className="text-sm text-gray-500">Nhấn <strong className="text-red-400">Bắt đầu Quét ngay</strong> để kiểm tra mối đe dọa trên VPS</p>
              </div>
            )}

            {/* Results */}
            {scanResult && (<>

              {/* Processes */}
              {scanResult.processes.length > 0 && (
                <div className="card-glass p-5 rounded-xl space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-red-400"><Cpu size={18} /> Tiến trình đáng ngờ ({scanResult.processes.length})</h3>
                  {scanResult.processes.map((p, i) => {
                    const rs = RISK_STYLES[p.risk] || RISK_STYLES.medium;
                    return (
                      <div key={i} style={{ background: rs.bg, border: rs.border, borderRadius: 12, padding: '14px 16px' }}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span style={{ fontSize: 11, fontWeight: 700, color: rs.badge, background: `${rs.badge}20`, padding: '2px 8px', borderRadius: 20 }}>{rs.label}</span>
                              <span className="font-mono text-xs text-gray-400">PID: {p.pid}</span>
                              <span className="text-xs text-gray-400">CPU: <strong className="text-yellow-400">{p.cpu}%</strong></span>
                              <span className="text-xs text-gray-400">RAM: {p.mem}%</span>
                              <span className="text-xs text-gray-400">User: <strong className="text-blue-400">{p.user}</strong></span>
                            </div>
                            <p className="font-mono text-xs text-gray-300 break-all">{p.cmd}</p>
                            <p className="text-xs text-gray-500 mt-1">⚠️ {p.reason}</p>
                          </div>
                          <button
                            onClick={() => handleKill(p.pid)}
                            disabled={actionLoading[`kill_${p.pid}`]}
                            className="btn btn-danger whitespace-nowrap"
                            style={{ padding: '7px 14px', fontSize: 12, flexShrink: 0 }}
                          >
                            {actionLoading[`kill_${p.pid}`] ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                            Diệt ngay
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cronjobs */}
              {scanResult.cronjobs.length > 0 && (
                <div className="card-glass p-5 rounded-xl space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-orange-400"><Clock size={18} /> Cronjob độc hại ({scanResult.cronjobs.length})</h3>
                  {scanResult.cronjobs.map((c, i) => {
                    const rs = RISK_STYLES[c.risk] || RISK_STYLES.high;
                    return (
                      <div key={i} style={{ background: rs.bg, border: rs.border, borderRadius: 12, padding: '14px 16px' }}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: 11, fontWeight: 700, color: rs.badge, background: `${rs.badge}20`, padding: '2px 8px', borderRadius: 20 }}>{rs.label}</span>
                              <span className="text-xs text-gray-400 font-mono">{c.source}:{c.lineNum}</span>
                            </div>
                            <p className="font-mono text-xs text-gray-300 break-all">{c.line}</p>
                            <p className="text-xs text-gray-500 mt-1">⚠️ {c.reason}</p>
                          </div>
                          {c.source !== '/etc/cron.d/*' && (
                            <button
                              onClick={() => handleCleanCron(c.source, c.lineNum)}
                              disabled={actionLoading[`cron_${c.lineNum}`]}
                              className="btn btn-danger whitespace-nowrap"
                              style={{ padding: '7px 14px', fontSize: 12, flexShrink: 0 }}
                            >
                              {actionLoading[`cron_${c.lineNum}`] ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              Xóa lệnh
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Network */}
              {scanResult.network.length > 0 && (
                <div className="card-glass p-5 rounded-xl space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-purple-400"><Network size={18} /> Kết nối mạng đáng ngờ ({scanResult.network.length})</h3>
                  {scanResult.network.map((n, i) => {
                    const rs = RISK_STYLES[n.risk] || RISK_STYLES.critical;
                    return (
                      <div key={i} style={{ background: rs.bg, border: rs.border, borderRadius: 12, padding: '14px 16px' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 11, fontWeight: 700, color: rs.badge, background: `${rs.badge}20`, padding: '2px 8px', borderRadius: 20 }}>{rs.label}</span>
                        </div>
                        <p className="font-mono text-xs text-gray-300 break-all">{n.line}</p>
                        <p className="text-xs text-gray-500 mt-1">⚠️ {n.reason}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Files */}
              {scanResult.files.length > 0 && (
                <div className="card-glass p-5 rounded-xl space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-yellow-400"><FileWarning size={18} /> File thực thi trong thư mục tạm ({scanResult.files.length})</h3>
                  {scanResult.files.map((f, i) => {
                    const rs = RISK_STYLES[f.risk] || RISK_STYLES.high;
                    return (
                      <div key={i} style={{ background: rs.bg, border: rs.border, borderRadius: 12, padding: '14px 16px' }}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: 11, fontWeight: 700, color: rs.badge, background: `${rs.badge}20`, padding: '2px 8px', borderRadius: 20 }}>{rs.label}</span>
                            </div>
                            <p className="font-mono text-xs text-gray-300 break-all">{f.path}</p>
                            <p className="text-xs text-gray-500 mt-1">⚠️ {f.reason}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteFile(f.path)}
                            disabled={actionLoading[`file_${f.path}`]}
                            className="btn btn-danger whitespace-nowrap"
                            style={{ padding: '7px 14px', fontSize: 12, flexShrink: 0 }}
                          >
                            {actionLoading[`file_${f.path}`] ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Xóa file
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All clear */}
              {totalThreats === 0 && (
                <div className="card-glass p-10 rounded-xl text-center">
                  <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-green-400 mb-1">Hệ thống sạch!</h3>
                  <p className="text-sm text-gray-400">Không phát hiện tiến trình, cronjob, kết nối hoặc file độc hại nào.</p>
                </div>
              )}
            </>)}
          </div>
        );
      })()}

      {/* TAB 8: Change Panel Password */}
      {activeTab === 'password' && (
        <div className="card-glass p-6 rounded-xl max-w-md mx-auto space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Lock size={18} className="text-indigo-400" />
            Đổi mật khẩu truy cập Panel
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Thay đổi mật khẩu bảo mật dùng để đăng nhập vào Bảng điều khiển VPS Manager Panel này.
          </p>
          <form onSubmit={handleChangePanelPassword} className="space-y-4" style={{ marginTop: '20px' }}>
            <div className="form-group text-left">
              <label className="text-xs text-gray-400 block mb-1">Mật khẩu hiện tại</label>
              <input
                type="password"
                required
                placeholder="Nhập mật khẩu hiện tại"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="input-glass w-full"
                style={{ padding: '10px', width: '100%' }}
              />
            </div>
            <div className="form-group text-left">
              <label className="text-xs text-gray-400 block mb-1">Mật khẩu mới (Tối thiểu 6 ký tự)</label>
              <input
                type="password"
                required
                placeholder="Nhập mật khẩu mới"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="input-glass w-full"
                style={{ padding: '10px', width: '100%' }}
              />
            </div>
            <div className="form-group text-left">
              <label className="text-xs text-gray-400 block mb-1">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                required
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="input-glass w-full"
                style={{ padding: '10px', width: '100%' }}
              />
            </div>
            <button type="submit" disabled={pwLoading} className="btn btn-primary btn-block flex items-center justify-center gap-2" style={{ padding: '12px', width: '100%', marginTop: '8px' }}>
              {pwLoading ? <RefreshCw size={16} className="animate-spin" /> : 'Lưu và Đổi mật khẩu'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
