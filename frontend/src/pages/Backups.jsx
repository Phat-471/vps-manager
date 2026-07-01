import React, { useState, useEffect, useRef } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Database, 
  Folder, 
  FolderPlus, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  Play, 
  Check, 
  X, 
  Plus, 
  RotateCcw, 
  Terminal, 
  Save, 
  Edit, 
  Cloud,
  ChevronRight,
  ShieldCheck,
  Server,
  Clock,
  Calendar
} from 'lucide-react';

export default function Backups() {
  const { apiCall, showToast, currentVPS, panelToken, socket, isConnected } = useVPS();
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);

  // Backups states
  const [backupFiles, setBackupFiles] = useState([]);
  const [databases, setDatabases] = useState([]);
  
  // Rclone states
  const [rcloneStatus, setRcloneStatus] = useState({ installed: false, configured: false });
  const [rcloneLoading, setRcloneLoading] = useState(false);
  const [remotes, setRemotes] = useState({});

  // Modals state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [showRcloneModal, setShowRcloneModal] = useState(false);
  
  // Selection states
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [syncFile, setSyncFile] = useState(null);
  const [syncRemote, setSyncRemote] = useState('');
  const [syncPath, setSyncPath] = useState('');
  const [syncingFile, setSyncingFile] = useState(false);

  // Form states for manual backup creation
  const [backupType, setBackupType] = useState('dir'); // dir or mysql
  const [backupSourceDir, setBackupSourceDir] = useState('/var/www/');
  const [backupDatabase, setBackupDatabase] = useState('');
  const [backupDbUser, setBackupDbUser] = useState('root');
  const [backupDbPass, setBackupDbPass] = useState('');
  const [backupKeepCount, setBackupKeepCount] = useState(5);
  const [backupCustomName, setBackupCustomName] = useState('');
  const [useRclone, setUseRclone] = useState(false);
  const [rcloneRemote, setRcloneRemote] = useState('');
  const [rclonePathName, setRclonePathName] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Form states for Restore
  const [restorePath, setRestorePath] = useState('/var/www');
  const [restoreDbUser, setRestoreDbUser] = useState('root');
  const [restoreDbPass, setRestoreDbPass] = useState('');
  const [cleanTarget, setCleanTarget] = useState(false);
  const [dropDatabase, setDropDatabase] = useState(false);
  const [restoringData, setRestoringData] = useState(false);

  // Form states for Rclone remote
  const [editingRemoteName, setEditingRemoteName] = useState(null);
  const [remoteName, setRemoteName] = useState('');
  const [remoteType, setRemoteType] = useState('drive');
  const [remoteParams, setRemoteParams] = useState({});
  const [remoteRawConfig, setRemoteRawConfig] = useState('');
  const [remoteInputMode, setRemoteInputMode] = useState('form');
  const [testingRemote, setTestingRemote] = useState(null);

  // Scheduling states
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedName, setSchedName] = useState('');
  const [schedType, setSchedType] = useState('dir');
  const [schedSourceDir, setSchedSourceDir] = useState('/var/www/');
  const [schedDatabase, setSchedDatabase] = useState('');
  const [schedDbUser, setSchedDbUser] = useState('root');
  const [schedDbPass, setSchedDbPass] = useState('');
  const [schedKeepCount, setSchedKeepCount] = useState(5);
  const [schedCronType, setSchedCronType] = useState('daily');
  const [schedCronCustom, setSchedCronCustom] = useState('0 2 * * *');
  const [schedUseRclone, setSchedUseRclone] = useState(false);
  const [schedRcloneRemote, setSchedRcloneRemote] = useState('');
  const [schedRclonePath, setSchedRclonePath] = useState('');
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  // Output terminal logs
  const [runLog, setRunLog] = useState(null);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [runLog]);

  useEffect(() => {
    if (isConnected && currentVPS) {
      fetchData();
    }
  }, [isConnected, currentVPS, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch backups list
      const fileRes = await apiCall('/api/backups/list', 'POST');
      setBackupFiles(fileRes.data || []);
      
      // Fetch rclone status & remotes
      await fetchRcloneStatus();

      // Fetch databases list for backup forms
      try {
        const dbRes = await apiCall('/api/mysql/databases', 'POST');
        setDatabases(dbRes.data || []);
        if (dbRes.data && dbRes.data.length > 0 && !backupDatabase) {
          setBackupDatabase(dbRes.data[0]);
        }
      } catch (dbErr) {
        console.log('Không thể lấy danh sách CSDL (MySQL có thể chưa được cài):', dbErr.message);
      }
      // Fetch schedules
      await fetchSchedules();
    } catch (err) {
      console.error('Lỗi nạp dữ liệu Sao lưu:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const res = await apiCall('/api/backups/schedule/list', 'POST');
      if (res.success) {
        setSchedules(res.data || []);
      }
    } catch (err) {
      console.error('Lỗi nạp lịch sao lưu:', err);
    } finally {
      setSchedulesLoading(false);
    }
  };

  const handleToggleSchedule = async (id, currentActive) => {
    try {
      showToast(`Đang ${currentActive ? 'tạm dừng' : 'kích hoạt'} lịch sao lưu...`, 'info');
      const res = await apiCall('/api/backups/schedule/toggle', 'POST', {
        scheduleId: id,
        active: !currentActive
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchSchedules();
      }
    } catch (err) {
      showToast('Thao tác thất bại: ' + err.message, 'error');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa lịch sao lưu tự động này?')) return;
    try {
      showToast('Đang xóa lịch sao lưu...', 'info');
      const res = await apiCall('/api/backups/schedule/delete', 'POST', {
        scheduleId: id
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchSchedules();
      }
    } catch (err) {
      showToast('Xóa thất bại: ' + err.message, 'error');
    }
  };

  const handleCreateScheduleSubmit = async (e) => {
    e.preventDefault();
    setCreatingSchedule(true);
    showToast('Đang tạo lịch sao lưu tự động trên VPS...', 'info');

    // Build cron expression
    let cronExpression = '0 2 * * *'; // default daily 2 AM
    if (schedCronType === 'hourly') {
      cronExpression = '0 * * * *';
    } else if (schedCronType === 'weekly') {
      cronExpression = '0 2 * * 0';
    } else if (schedCronType === 'custom') {
      cronExpression = schedCronCustom.trim();
    }

    const payload = {
      name: schedName.trim(),
      type: schedType,
      keep: schedKeepCount,
      cronExpression
    };

    if (schedType === 'dir') {
      if (!schedSourceDir.trim()) {
        showToast('Vui lòng nhập đường dẫn thư mục nguồn', 'warning');
        setCreatingSchedule(false);
        return;
      }
      payload.source = schedSourceDir.trim();
    } else {
      if (!schedDatabase) {
        showToast('Vui lòng chọn Database để sao lưu', 'warning');
        setCreatingSchedule(false);
        return;
      }
      payload.database = schedDatabase;
      payload.dbUser = schedDbUser;
      payload.dbPass = schedDbPass;
    }

    if (schedUseRclone && schedRcloneRemote) {
      payload.rcloneRemote = schedRcloneRemote;
      payload.rclonePath = schedRclonePath;
    }

    try {
      const res = await apiCall('/api/backups/schedule/create', 'POST', payload);
      if (res.success) {
        showToast('Đã lên lịch sao lưu tự động thành công!', 'success');
        fetchSchedules();
        setShowScheduleModal(false);
        setSchedName('');
        setSchedSourceDir('/var/www/');
        setSchedKeepCount(5);
        setSchedUseRclone(false);
      }
    } catch (err) {
      showToast('Lên lịch thất bại: ' + err.message, 'error');
    } finally {
      setCreatingSchedule(false);
    }
  };

  const fetchRcloneStatus = async () => {
    try {
      const res = await apiCall('/api/backups/rclone/status', 'POST');
      if (res.success && res.data) {
        setRcloneStatus(res.data);
        if (res.data.installed) {
          const remoteRes = await apiCall('/api/backups/rclone/remotes', 'POST');
          if (remoteRes.success) {
            setRemotes(remoteRes.remotes || {});
            setRcloneStatus(prev => ({
              ...prev,
              installed: remoteRes.installed,
              configured: Object.keys(remoteRes.remotes || {}).length > 0
            }));
          }
        }
      }
    } catch (err) {
      console.error('Lỗi check rclone status:', err);
    }
  };

  const handleInstallRclone = async () => {
    setRcloneLoading(true);
    showToast('Đang khởi chạy tiến trình cài đặt Rclone trên VPS...', 'info');
    try {
      const res = await apiCall('/api/backups/rclone/install', 'POST');
      if (res.success) {
        showToast('Đã gửi lệnh cài đặt Rclone thành công!', 'success');
        setRunLog(`[Cài đặt Rclone]\nExit Code: 0\nLogs:\n${res.log || 'Không có log.'}`);
        fetchRcloneStatus();
      }
    } catch (err) {
      showToast('Lỗi khi cài đặt Rclone: ' + err.message, 'error');
    } finally {
      setRcloneLoading(false);
    }
  };

  const handleOpenAddRemote = () => {
    setEditingRemoteName(null);
    setRemoteName('');
    setRemoteType('drive');
    setRemoteParams({});
    setRemoteRawConfig('');
    setRemoteInputMode('form');
    setShowRcloneModal(true);
  };

  const handleOpenEditRemote = (name, config) => {
    setEditingRemoteName(name);
    setRemoteName(name);
    setRemoteType(config.type || 'drive');
    const { type, ...params } = config;
    setRemoteParams(params);
    
    let raw = `[${name}]\ntype = ${config.type || 'drive'}\n`;
    for (const [k, v] of Object.entries(params)) {
      raw += `${k} = ${v}\n`;
    }
    setRemoteRawConfig(raw);
    setRemoteInputMode('form');
    setShowRcloneModal(true);
  };

  const handleSaveRemote = async (e) => {
    e.preventDefault();
    if (!remoteName.trim() && remoteInputMode === 'form') {
      showToast('Vui lòng nhập tên Remote', 'warning');
      return;
    }

    try {
      showToast('Đang lưu cấu hình Remote...', 'info');
      const payload = {
        name: remoteName.trim(),
        type: remoteType,
        parameters: remoteParams
      };
      if (remoteInputMode === 'raw') {
        payload.rawConfig = remoteRawConfig.trim();
      }
      const res = await apiCall('/api/backups/rclone/remotes/save', 'POST', payload);
      if (res.success) {
        showToast('Đã lưu cấu hình Remote thành công', 'success');
        setShowRcloneModal(false);
        fetchRcloneStatus();
      }
    } catch (err) {
      showToast('Lỗi khi lưu cấu hình remote: ' + err.message, 'error');
    }
  };

  const handleDeleteRemote = async (name) => {
    if (!window.confirm(`Bạn có chắc muốn xóa Cloud Remote "${name}"?`)) return;
    try {
      showToast('Đang xóa remote...', 'info');
      const res = await apiCall('/api/backups/rclone/remotes/delete', 'POST', { name });
      if (res.success) {
        showToast('Đã xóa remote thành công', 'success');
        fetchRcloneStatus();
      }
    } catch (err) {
      showToast('Lỗi khi xóa remote: ' + err.message, 'error');
    }
  };

  const handleTestRemote = async (name) => {
    setTestingRemote(name);
    showToast(`Đang kết nối thử đến remote "${name}"...`, 'info');
    try {
      const res = await apiCall('/api/backups/rclone/remotes/test', 'POST', { name });
      if (res.success) {
        showToast(`Kết nối đến remote "${name}" thành công!`, 'success');
        setRunLog(`[Kết nối THÀNH CÔNG đến ${name}:]\n\nSTDOUT:\n${res.stdout}\n`);
      } else {
        showToast(`Kết nối đến remote "${name}" thất bại!`, 'error');
        setRunLog(`[Kết nối THẤT BẠI đến ${name}:]\n\nSTDERR:\n${res.stderr || 'Không thể liên kết hoặc sai thông tin.'}\n`);
      }
    } catch (err) {
      showToast('Lỗi khi test remote: ' + err.message, 'error');
    } finally {
      setTestingRemote(null);
    }
  };

  const handleCreateBackupSubmit = async (e) => {
    e.preventDefault();
    setCreatingBackup(true);
    showToast('Đang khởi chạy tiến trình sao lưu trên VPS...', 'info');
    
    const payload = {
      type: backupType,
      keep: backupKeepCount,
      name: backupCustomName.trim()
    };

    if (backupType === 'dir') {
      if (!backupSourceDir.trim()) {
        showToast('Vui lòng nhập đường dẫn thư mục nguồn', 'warning');
        setCreatingBackup(false);
        return;
      }
      payload.source = backupSourceDir.trim();
    } else {
      if (!backupDatabase) {
        showToast('Vui lòng chọn Database để sao lưu', 'warning');
        setCreatingBackup(false);
        return;
      }
      payload.database = backupDatabase;
      payload.dbUser = backupDbUser;
      payload.dbPass = backupDbPass;
    }

    if (useRclone && rcloneRemote) {
      payload.rcloneRemote = rcloneRemote;
      payload.rclonePath = rclonePathName;
    }

    try {
      const res = await apiCall('/api/backups/create', 'POST', payload);
      if (res.success) {
        showToast('Đã hoàn thành sao lưu thành công!', 'success');
        setRunLog(`[Sao lưu Thành công]\nLogs:\n${res.log}`);
        fetchData();
        setShowBackupModal(false);
      }
    } catch (err) {
      showToast('Sao lưu thất bại: ' + err.message, 'error');
      if (err.log) setRunLog(`[Sao lưu Thất bại]\n${err.log}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      showToast(`Đang chuẩn bị tải xuống ${filename}...`, 'info');
      const response = await fetch('/api/backups/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${panelToken}`
        },
        body: JSON.stringify({
          vpsConfig: currentVPS,
          filename
        })
      });

      if (!response.ok) throw new Error('Không thể tải file sao lưu từ VPS');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      showToast('Đã tải xuống file thành công!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn tệp sao lưu "${filename}" khỏi VPS?`)) return;
    try {
      await apiCall('/api/backups/delete', 'POST', { filename });
      showToast('Đã xóa tệp sao lưu thành công', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCloudSyncModal = (file) => {
    setSyncFile(file);
    setSyncRemote(Object.keys(remotes)[0] || '');
    setSyncPath('');
    setShowCloudSyncModal(true);
  };

  const handleCloudSyncSubmit = async (e) => {
    e.preventDefault();
    if (!syncFile || !syncRemote) {
      showToast('Vui lòng chọn Cloud Remote để đồng bộ', 'warning');
      return;
    }
    setSyncingFile(true);
    showToast(`Đang đẩy tệp ${syncFile.filename} lên Cloud remote "${syncRemote}"...`, 'info');
    try {
      const res = await apiCall('/api/backups/rclone/sync-file', 'POST', {
        filename: syncFile.filename,
        rcloneRemote: syncRemote,
        rclonePath: syncPath
      });
      if (res.success) {
        showToast(res.message, 'success');
        setShowCloudSyncModal(false);
      }
    } catch (err) {
      showToast('Đồng bộ lên Cloud thất bại: ' + err.message, 'error');
    } finally {
      setSyncingFile(false);
    }
  };

  const handleOpenRestore = (backup) => {
    setSelectedBackup(backup);
    setCleanTarget(false);
    setDropDatabase(false);
    if (backup.type === 'dir') {
      setRestorePath(`/var/www/${backup.targetName}`);
    } else {
      setRestoreDbUser('root');
      setRestoreDbPass('');
    }
    setShowRestoreModal(true);
  };

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!selectedBackup) return;
    setRestoringData(true);
    showToast('Đang chạy tiến trình khôi phục dữ liệu trên VPS...', 'info');

    const payload = {
      filename: selectedBackup.filename,
      cleanTarget,
      dropDatabase
    };

    if (selectedBackup.type === 'dir') {
      if (!restorePath.trim()) {
        showToast('Vui lòng nhập đường dẫn thư mục khôi phục', 'warning');
        setRestoringData(false);
        return;
      }
      payload.restorePath = restorePath.trim();
    } else {
      payload.dbUser = restoreDbUser;
      payload.dbPass = restoreDbPass;
    }

    try {
      const res = await apiCall('/api/backups/restore', 'POST', payload);
      if (res.success) {
        showToast('Đã khôi phục dữ liệu thành công!', 'success');
        setRunLog(`[Khôi phục dữ liệu thành công]\nLogs:\n${res.log}`);
        setShowRestoreModal(false);
      }
    } catch (err) {
      showToast('Khôi phục dữ liệu thất bại: ' + err.message, 'error');
      if (err.log) setRunLog(`[Khôi phục dữ liệu thất bại]\n${err.log}`);
    } finally {
      setRestoringData(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Explorer Header */}
      <div className="explorer-header flex justify-between items-center">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Sao lưu & Đám mây (Backups & Cloud Sync)</h1>
          <p className="text-sm text-gray-400">Sao lưu an toàn mã nguồn, cơ sở dữ liệu MySQL cục bộ và đồng bộ tự động lên các dịch vụ đám mây thông qua Rclone.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBackupModal(true)} 
            className="btn btn-primary flex items-center gap-1.5 font-semibold text-xs"
          >
            <Plus size={14} /> Sao lưu thủ công
          </button>
          <button 
            onClick={() => {
              setSchedName('');
              setSchedSourceDir('/var/www/');
              setSchedKeepCount(5);
              setSchedUseRclone(false);
              if (databases.length > 0 && !schedDatabase) {
                setSchedDatabase(databases[0]);
              }
              setShowScheduleModal(true);
            }} 
            className="btn btn-secondary flex items-center gap-1.5 font-semibold text-xs"
          >
            <Clock size={14} /> Lập lịch sao lưu
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-glass flex items-center gap-1.5 font-semibold text-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="db-tabs-container card-glass p-1.5 flex gap-2 rounded-xl">
        <button
          onClick={() => setActiveTab('list')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'list'
              ? 'active bg-indigo-500/20 text-indigo-300'
              : 'text-gray-400 hover:text-white'
          }`}
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <FolderPlus size={16} /> Các bản sao lưu hiện tại
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'schedule'
              ? 'active bg-indigo-500/20 text-indigo-300'
              : 'text-gray-400 hover:text-white'
          }`}
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <Clock size={16} /> Tự động sao lưu định kỳ
        </button>
        <button
          onClick={() => setActiveTab('rclone')}
          className={`db-tab-item py-2.5 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'rclone'
              ? 'active bg-indigo-500/20 text-indigo-300'
              : 'text-gray-400 hover:text-white'
          }`}
          style={{ border: 'none', cursor: 'pointer' }}
        >
          <Cloud size={16} /> Cấu hình Cloud (Rclone)
        </button>
      </div>

      {loading && backupFiles.length === 0 && (
        <div className="card-glass p-8 text-center text-gray-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang truy xuất thông tin sao lưu trên VPS...
        </div>
      )}

      {/* Tab 1: Backups List */}
      {!loading && activeTab === 'list' && (
        <div className="card-glass overflow-hidden rounded-xl">
          <div className="p-4 border-b border-white/5 bg-white/[0.01]">
            <h2 className="text-sm font-semibold text-gray-300">Kho lưu trữ tệp sao lưu cục bộ trên máy chủ</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tệp lưu tại đường dẫn VPS: <code className="text-indigo-300">/var/www/vps-manager-backups/</code></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase font-mono text-[11px] tracking-wider">
                  <th className="p-4">Tên file sao lưu</th>
                  <th className="p-4">Loại dữ liệu</th>
                  <th className="p-4">Tên gốc/CSDL</th>
                  <th className="p-4">Dung lượng</th>
                  <th className="p-4">Ngày tạo</th>
                  <th className="p-4 text-right" style={{ width: '280px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {backupFiles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">
                      Thư mục sao lưu trống. Hãy bấm "Tạo bản sao lưu mới" để bắt đầu sao lưu VPS.
                    </td>
                  </tr>
                ) : (
                  backupFiles.map((file) => (
                    <tr key={file.filename} className="hover:bg-white/[0.01] transition-all">
                      <td className="p-4 font-mono text-xs text-gray-300 truncate max-w-[200px]" title={file.filename}>
                        {file.filename}
                      </td>
                      <td className="p-4">
                        {file.type === 'dir' ? (
                          <span className="badge text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded text-xs flex items-center gap-1 w-max">
                            <Folder size={12} /> Folder
                          </span>
                        ) : (
                          <span className="badge text-indigo-300 bg-indigo-400/10 px-2 py-0.5 rounded text-xs flex items-center gap-1 w-max">
                            <Database size={12} /> MySQL
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-gray-300">{file.targetName}</td>
                      <td className="p-4 text-gray-300">{file.size}</td>
                      <td className="p-4 text-gray-300 text-xs">{file.createdAt}</td>
                      <td className="p-4 text-right">
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenRestore(file)}
                            className="btn btn-glass btn-sm text-green-300 flex items-center gap-1"
                            title="Khôi phục ghi đè lên thư mục hoặc DB"
                          >
                            <RotateCcw size={12} /> Phục hồi
                          </button>
                          {rcloneStatus.installed && Object.keys(remotes).length > 0 && (
                            <button
                              onClick={() => handleOpenCloudSyncModal(file)}
                              className="btn btn-glass btn-sm text-orange-300 flex items-center gap-1"
                              title="Tải tệp này lên Cloud Drive"
                            >
                              <Upload size={12} /> Sync Cloud
                            </button>
                          )}
                          <button
                            onClick={() => handleDownloadBackup(file.filename)}
                            className="btn btn-glass btn-sm text-indigo-300"
                            title="Tải về máy tính PC"
                            style={{ padding: '6px' }}
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(file.filename)}
                            className="btn btn-glass btn-sm text-red-400"
                            title="Xóa tệp khỏi VPS"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Backup Schedules List */}
      {!loading && activeTab === 'schedule' && (
        <div className="card-glass overflow-hidden rounded-xl">
          <div className="p-4 border-b border-white/5 bg-white/[0.01] flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="text-sm font-semibold text-gray-300">Lịch trình sao lưu tự động định kỳ</h2>
              <p className="text-xs text-gray-500 mt-0.5">Tự động nén dữ liệu và đẩy lên đám mây thông qua Cronjob của hệ thống.</p>
            </div>
            <button
              onClick={() => {
                setSchedName('');
                setSchedSourceDir('/var/www/');
                setSchedKeepCount(5);
                setSchedUseRclone(false);
                if (databases.length > 0 && !schedDatabase) {
                  setSchedDatabase(databases[0]);
                }
                setShowScheduleModal(true);
              }}
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-semibold text-xs"
            >
              <Plus size={14} /> Thêm Lịch trình mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase font-mono text-[11px] tracking-wider">
                  <th className="p-4">Tên Lịch trình</th>
                  <th className="p-4">Loại đối tượng</th>
                  <th className="p-4">Nguồn/Database</th>
                  <th className="p-4">Tần suất (Cron)</th>
                  <th className="p-4">Đẩy lên Cloud</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right" style={{ width: '180px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {schedulesLoading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                      Đang nạp danh sách lịch trình...
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-400">
                      Chưa cấu hình lịch trình sao lưu tự động nào. Hãy bấm "Thêm Lịch trình mới" để thiết lập.
                    </td>
                  </tr>
                ) : (
                  schedules.map((sched) => (
                    <tr key={sched.id} className="hover:bg-white/[0.01] transition-all">
                      <td className="p-4 font-semibold text-gray-200">{sched.name}</td>
                      <td className="p-4">
                        {sched.type === 'dir' ? (
                          <span className="badge text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded text-xs flex items-center gap-1 w-max">
                            <Folder size={12} /> Folder
                          </span>
                        ) : (
                          <span className="badge text-indigo-300 bg-indigo-400/10 px-2 py-0.5 rounded text-xs flex items-center gap-1 w-max">
                            <Database size={12} /> MySQL
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-300">
                        {sched.type === 'dir' ? sched.source : sched.database}
                      </td>
                      <td className="p-4 font-mono text-xs text-indigo-300" title="Thời gian chạy theo múi giờ máy chủ">
                        {sched.cronExpression}
                      </td>
                      <td className="p-4">
                        {sched.rcloneRemote ? (
                          <span className="text-green-300 flex items-center gap-1 text-xs">
                            <Cloud size={12} /> {sched.rcloneRemote}:{sched.rclonePath || '/'}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Chỉ lưu local</span>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSchedule(sched.id, sched.active)}
                          className={`btn btn-xs ${sched.active ? 'btn-success bg-green-500/10 text-green-300' : 'btn-secondary bg-gray-500/10 text-gray-400'}`}
                          style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer', border: 'none' }}
                        >
                          {sched.active ? '● Hoạt động' : '○ Tạm dừng'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteSchedule(sched.id)}
                          className="btn btn-glass btn-sm text-red-400"
                          title="Xóa lịch trình sao lưu"
                          style={{ padding: '6px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Rclone Config */}
      {!loading && activeTab === 'rclone' && (
        <div className="space-y-6">
          <div className="card-glass p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-200">
                  <Cloud size={18} className="text-indigo-400" />
                  Đồng bộ đám mây với Rclone
                </h2>
                <p className="text-xs text-gray-400 font-normal">Quản lý các tài khoản đám mây (Google Drive, OneDrive, Amazon S3) liên kết trực tiếp trên máy chủ.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!rcloneStatus.installed && (
                  <button 
                    onClick={handleInstallRclone} 
                    disabled={rcloneLoading}
                    className="btn btn-glass btn-sm text-yellow-400"
                  >
                    {rcloneLoading ? 'Đang cài đặt...' : 'Cài đặt Rclone lên VPS'}
                  </button>
                )}
                {rcloneStatus.installed && (
                  <button
                    onClick={handleOpenAddRemote}
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Thêm Cloud Remote
                  </button>
                )}
                <button 
                  onClick={fetchRcloneStatus} 
                  className="btn btn-glass btn-sm"
                >
                  Kiểm tra trạng thái
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Trạng thái Rclone Daemon</span>
                <div className="flex flex-col gap-2 pt-1 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Rclone Binary trên VPS:</span>
                    <span className={rcloneStatus.installed ? 'text-green-400 font-bold' : 'text-red-400'}>
                      {rcloneStatus.installed ? '✔ Đã cài đặt' : '✘ Chưa cài đặt'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Tài khoản Cloud đã kết nối:</span>
                    <span className={rcloneStatus.configured ? 'text-green-400 font-bold' : 'text-yellow-400'}>
                      {rcloneStatus.configured ? `✔ Sẵn sàng (${Object.keys(remotes).length} remote)` : '✘ Chưa có Remote'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/5 text-xs text-gray-300 space-y-1.5 leading-relaxed font-normal">
                <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">Hướng dẫn sử dụng</span>
                <p>1. Cài đặt Rclone lên VPS bằng nút phía trên nếu chưa có.</p>
                <p>2. Chọn **Thêm Cloud Remote**, thiết lập thông tin hoặc dán cấu hình từ máy tính của bạn.</p>
                <p>3. Các tệp sao lưu sau khi được tạo có thể bấm **Sync Cloud** để lưu trữ đám mây từ xa an toàn.</p>
              </div>
            </div>

            {/* Rclone Remotes List */}
            {rcloneStatus.installed && (
              <div className="pt-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Danh sách Cloud Remotes hiện tại</h3>
                {Object.keys(remotes).length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 bg-white/[0.02] border border-white/5 rounded-lg">
                    Chưa có Cloud Remote nào được thiết lập. Hãy thêm một Remote để bắt đầu đồng bộ.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-white/5 rounded-lg bg-white/[0.01]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase font-mono text-[10px] tracking-wider">
                          <th className="p-3">Tên Remote</th>
                          <th className="p-3">Dịch vụ đám mây</th>
                          <th className="p-3">Tham số cấu hình</th>
                          <th className="p-3 text-right" style={{ width: '240px' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {Object.entries(remotes).map(([name, config]) => (
                          <tr key={name} className="hover:bg-white/[0.01]">
                            <td className="p-3 font-semibold text-gray-200">{name}</td>
                            <td className="p-3">
                              <span className="badge text-indigo-300 bg-indigo-400/10 px-2 py-0.5 rounded text-[11px] font-mono uppercase">
                                {config.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-gray-400 text-[10px] truncate max-w-[200px]" title={JSON.stringify(config)}>
                              {Object.entries(config)
                                .filter(([k]) => k !== 'type' && k !== 'token' && k !== 'secret_access_key')
                                .map(([k, v]) => `${k}=${v}`)
                                .join(', ') || 'N/A'}
                            </td>
                            <td className="p-3 text-right">
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleTestRemote(name)}
                                  disabled={testingRemote === name}
                                  className="btn btn-glass btn-sm text-green-300"
                                >
                                  {testingRemote === name ? 'Đang test...' : 'Test kết nối'}
                                </button>
                                <button
                                  onClick={() => handleOpenEditRemote(name, config)}
                                  className="btn btn-glass btn-sm text-blue-300"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleDeleteRemote(name)}
                                  className="btn btn-glass btn-sm text-red-400"
                                >
                                  Xóa
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
          </div>
        </div>
      )}

      {/* Terminal run logs area if user ran a test/backup/restore */}
      {runLog && (
        <div className="card-glass p-5 rounded-xl space-y-3 animate-fade-in">
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-green-400">
              <Terminal size={16} /> Nhật ký thực thi nhiệm vụ
            </h3>
            <button onClick={() => setRunLog(null)} className="btn btn-glass btn-sm" style={{ padding: '2px 8px' }}>
              Đóng log
            </button>
          </div>
          <pre ref={logContainerRef} className="p-4 bg-black/60 text-emerald-400 font-mono text-xs rounded-lg max-h-[300px] overflow-y-auto whitespace-pre-wrap border border-white/5">
            {runLog}
          </pre>
        </div>
      )}

      {/* MODAL: Create Schedule Backup */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <Clock size={20} className="text-indigo-400" />
                Lập lịch sao lưu tự động
              </h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateScheduleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Tên Lịch trình (để quản lý):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Backup Daily Website, Backup DB Weekly"
                  value={schedName}
                  onChange={(e) => setSchedName(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Loại đối tượng sao lưu:</label>
                <select
                  value={schedType}
                  onChange={(e) => setSchedType(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                >
                  <option value="dir">Thư mục nguồn (Mã nguồn)</option>
                  <option value="mysql">Database MySQL (Cơ sở dữ liệu)</option>
                </select>
              </div>

              {schedType === 'dir' ? (
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Đường dẫn thư mục nguồn trên VPS:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: /var/www/mywebsite.com"
                    value={schedSourceDir}
                    onChange={(e) => setSchedSourceDir(e.target.value)}
                    className="input-glass w-full font-mono text-xs"
                    style={{ padding: '8px' }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Chọn Database cần sao lưu:</label>
                    {databases.length === 0 ? (
                      <div className="text-xs text-yellow-400 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                        Không phát hiện cơ sở dữ liệu MySQL hoạt động trên VPS.
                      </div>
                    ) : (
                      <select
                        value={schedDatabase}
                        onChange={(e) => setSchedDatabase(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px' }}
                      >
                        {databases.map(db => (
                          <option key={db} value={db}>{db}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium text-xs">MySQL User (Thường là root):</label>
                    <input
                      type="text"
                      value={schedDbUser}
                      onChange={(e) => setSchedDbUser(e.target.value)}
                      className="input-glass w-full text-xs"
                      style={{ padding: '6px' }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium text-xs">MySQL Password:</label>
                    <input
                      type="password"
                      placeholder="Mật khẩu MySQL (để trống nếu dùng auth socket)"
                      value={schedDbPass}
                      onChange={(e) => setSchedDbPass(e.target.value)}
                      className="input-glass w-full text-xs"
                      style={{ padding: '6px' }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Tần suất chạy (Time Schedule):</label>
                <select
                  value={schedCronType}
                  onChange={(e) => setSchedCronType(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                >
                  <option value="hourly">Mỗi giờ một lần (Hourly)</option>
                  <option value="daily">Hàng ngày lúc 02:00 sáng (Daily)</option>
                  <option value="weekly">Hàng tuần lúc 02:00 sáng Chủ Nhật (Weekly)</option>
                  <option value="custom">Biểu thức Cron tùy chỉnh (Custom Cron)</option>
                </select>
              </div>

              {schedCronType === 'custom' && (
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium font-mono text-xs">Nhập biểu thức Cron:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0 0 * * * (chạy vào nửa đêm hàng ngày)"
                    value={schedCronCustom}
                    onChange={(e) => setSchedCronCustom(e.target.value)}
                    className="input-glass w-full font-mono text-xs"
                    style={{ padding: '8px' }}
                  />
                  <p className="text-[10px] text-gray-500">Định dạng tiêu chuẩn: Phút Giờ Ngày Tháng Thứ.</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Giới hạn số bản sao lưu local giữ lại:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={schedKeepCount}
                  onChange={(e) => setSchedKeepCount(parseInt(e.target.value) || 5)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                />
              </div>

              {/* Rclone Sync */}
              {rcloneStatus.installed && Object.keys(remotes).length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sched_use_rclone"
                      checked={schedUseRclone}
                      onChange={(e) => setSchedUseRclone(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="sched_use_rclone" className="text-gray-300 font-medium cursor-pointer text-xs">
                      Tự động tải lên đám mây (Cloud Sync)
                    </label>
                  </div>

                  {schedUseRclone && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs">Chọn Cloud Remote:</label>
                        <select
                          value={schedRcloneRemote}
                          onChange={(e) => setSchedRcloneRemote(e.target.value)}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        >
                          <option value="">-- Chọn Remote --</option>
                          {Object.keys(remotes).map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs">Thư mục trên Cloud (Path):</label>
                        <input
                          type="text"
                          placeholder="VD: backup/web"
                          value={schedRclonePath}
                          onChange={(e) => setSchedRclonePath(e.target.value)}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-white/10 flex justify-end gap-2" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="btn btn-secondary font-semibold"
                  style={{ padding: '8px 16px' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creatingSchedule}
                  className="btn btn-primary font-semibold"
                  style={{ padding: '8px 16px' }}
                >
                  {creatingSchedule ? 'Đang thiết lập...' : 'Thiết lập Lịch trình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Backup (Manual & Auto Options) */}
      {showBackupModal && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200">
                Tạo bản sao lưu dữ liệu thủ công
              </h2>
              <button onClick={() => setShowBackupModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBackupSubmit} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Loại đối tượng sao lưu:</label>
                <select
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                >
                  <option value="dir">Thư mục nguồn (Mã nguồn)</option>
                  <option value="mysql">Database MySQL (Cơ sở dữ liệu)</option>
                </select>
              </div>

              {backupType === 'dir' ? (
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Đường dẫn thư mục nguồn trên VPS:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: /var/www/mywebsite.com"
                    value={backupSourceDir}
                    onChange={(e) => setBackupSourceDir(e.target.value)}
                    className="input-glass w-full font-mono text-xs"
                    style={{ padding: '8px' }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Chọn Database cần sao lưu:</label>
                    {databases.length === 0 ? (
                      <div className="text-xs text-yellow-400 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                        Không phát hiện cơ sở dữ liệu MySQL hoạt động trên VPS.
                      </div>
                    ) : (
                      <select
                        value={backupDatabase}
                        onChange={(e) => setBackupDatabase(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px' }}
                      >
                        {databases.map(db => (
                          <option key={db} value={db}>{db}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium text-xs">MySQL User (Thường là root):</label>
                    <input
                      type="text"
                      value={backupDbUser}
                      onChange={(e) => setBackupDbUser(e.target.value)}
                      className="input-glass w-full text-xs"
                      style={{ padding: '6px' }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium text-xs">MySQL Password:</label>
                    <input
                      type="password"
                      placeholder="Mật khẩu MySQL (để trống nếu dùng auth socket)"
                      value={backupDbPass}
                      onChange={(e) => setBackupDbPass(e.target.value)}
                      className="input-glass w-full text-xs"
                      style={{ padding: '6px' }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Tên gắn thêm để phân biệt (Tùy chọn):</label>
                <input
                  type="text"
                  placeholder="VD: clean, update_core..."
                  value={backupCustomName}
                  onChange={(e) => setBackupCustomName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Giới hạn số bản sao giữ lại cục bộ:</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={backupKeepCount}
                  onChange={(e) => setBackupKeepCount(parseInt(e.target.value) || 5)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                />
                <p className="text-[10px] text-gray-500">Hệ thống sẽ tự động xóa các bản sao lưu cũ vượt quá số lượng này.</p>
              </div>

              {/* Rclone Auto Sync integration */}
              {rcloneStatus.installed && Object.keys(remotes).length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use_rclone"
                      checked={useRclone}
                      onChange={(e) => setUseRclone(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="use_rclone" className="text-gray-200 cursor-pointer font-semibold">Tự động đẩy lên Cloud ngay sau khi nén</label>
                  </div>

                  {useRclone && (
                    <div className="space-y-2 pl-6 animate-fade-in">
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs block">Chọn Cloud Remote:</label>
                        <select
                          value={rcloneRemote}
                          onChange={(e) => setRcloneRemote(e.target.value)}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        >
                          <option value="">-- Chọn Remote --</option>
                          {Object.keys(remotes).map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs block">Thư mục lưu trên mây (Rclone Path):</label>
                        <input
                          type="text"
                          placeholder="VD: vps_backups"
                          value={rclonePathName}
                          onChange={(e) => setRclonePathName(e.target.value)}
                          className="input-glass w-full text-xs font-mono"
                          style={{ padding: '6px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowBackupModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingBackup}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {creatingBackup ? (
                    <RefreshCw className="animate-spin w-4 h-4" />
                  ) : (
                    <Save size={16} />
                  )}
                  Tiến hành sao lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Restore Backup */}
      {showRestoreModal && selectedBackup && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200">
                Khôi phục dữ liệu trên VPS
              </h2>
              <button onClick={() => setShowRestoreModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRestoreBackup} className="space-y-4 text-sm">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-lg flex gap-2">
                <Check size={18} className="flex-shrink-0" />
                <div>
                  <strong>CẢNH BÁO BẢO MẬT:</strong> Tiến trình này sẽ giải nén hoặc nạp dữ liệu đè lên cấu hình hiện có của bạn. Hãy đảm bảo dữ liệu quan trọng đã được lưu trữ dự phòng.
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-300 bg-white/5 p-3 rounded-lg border border-white/5">
                <div><span className="text-gray-400">Tệp sao lưu:</span> <strong className="font-mono">{selectedBackup.filename}</strong></div>
                <div><span className="text-gray-400">Dung lượng:</span> <strong>{selectedBackup.size}</strong></div>
                <div><span className="text-gray-400">Thời gian tạo:</span> <strong>{selectedBackup.createdAt}</strong></div>
              </div>

              {selectedBackup.type === 'dir' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Đường dẫn giải nén khôi phục (Destination):</label>
                    <input
                      type="text"
                      required
                      value={restorePath}
                      onChange={(e) => setRestorePath(e.target.value)}
                      className="input-glass w-full font-mono text-xs"
                      style={{ padding: '8px' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="clean_target"
                      checked={cleanTarget}
                      onChange={(e) => setCleanTarget(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="clean_target" className="text-gray-200 cursor-pointer">Xóa sạch thư mục đích trước khi giải nén (Clean target)</label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1 text-xs text-gray-400">
                    Dữ liệu sẽ được tự động giải nén và nạp trực tiếp vào cơ sở dữ liệu MySQL: <strong className="text-indigo-400 font-mono">{selectedBackup.targetName}</strong>
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium text-xs">MySQL User:</label>
                    <input
                      type="text"
                      required
                      value={restoreDbUser}
                      onChange={(e) => setRestoreDbUser(e.target.value)}
                      className="input-glass w-full text-xs"
                      style={{ padding: '6px' }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium text-xs">MySQL Password:</label>
                    <input
                      type="password"
                      placeholder="Trống nếu sử dụng socket authentication"
                      value={restoreDbPass}
                      onChange={(e) => setRestoreDbPass(e.target.value)}
                      className="input-glass w-full text-xs"
                      style={{ padding: '6px' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="drop_database"
                      checked={dropDatabase}
                      onChange={(e) => setDropDatabase(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="drop_database" className="text-gray-200 cursor-pointer">Xóa (Drop) CSDL cũ trước khi nạp lại</label>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={restoringData}
                  className="btn btn-danger flex items-center gap-1.5"
                >
                  {restoringData ? (
                    <RefreshCw className="animate-spin w-4 h-4" />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Bắt đầu khôi phục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Cloud Sync */}
      {showCloudSyncModal && syncFile && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200">
                Đồng bộ tệp lên Cloud Drive
              </h2>
              <button onClick={() => setShowCloudSyncModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCloudSyncSubmit} className="space-y-4 text-sm">
              <div className="space-y-1 text-xs text-gray-300">
                Tệp tin: <strong className="font-mono text-indigo-300">{syncFile.filename}</strong> ({syncFile.size})
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Chọn tài khoản đám mây (Cloud Remote):</label>
                <select
                  value={syncRemote}
                  onChange={(e) => setSyncRemote(e.target.value)}
                  required
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                >
                  {Object.keys(remotes).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Đường dẫn thư mục lưu trên mây (Rclone Path):</label>
                <input
                  type="text"
                  placeholder="VD: back_up_vps/source"
                  value={syncPath}
                  onChange={(e) => setSyncPath(e.target.value)}
                  className="input-glass w-full font-mono text-xs"
                  style={{ padding: '8px' }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCloudSyncModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={syncingFile}
                  className="btn btn-primary flex items-center gap-1.5"
                >
                  {syncingFile ? (
                    <RefreshCw className="animate-spin w-4 h-4" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Bắt đầu đồng bộ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Rclone Cloud Remote Manager (Add/Edit) */}
      {showRcloneModal && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-lg w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200">
                {editingRemoteName ? `Cấu hình Remote: ${editingRemoteName}` : 'Cài đặt Cloud Remote mới'}
              </h2>
              <button onClick={() => setShowRcloneModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 text-xs font-semibold" style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setRemoteInputMode('form')}
                className={`flex-1 py-1.5 rounded transition-all ${
                  remoteInputMode === 'form' ? 'bg-indigo-500 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                }`}
                style={{ border: 'none', cursor: 'pointer', background: remoteInputMode === 'form' ? '' : 'transparent' }}
              >
                Giao diện nhập liệu
              </button>
              <button
                type="button"
                onClick={() => setRemoteInputMode('raw')}
                className={`flex-1 py-1.5 rounded transition-all ${
                  remoteInputMode === 'raw' ? 'bg-indigo-500 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                }`}
                style={{ border: 'none', cursor: 'pointer', background: remoteInputMode === 'raw' ? '' : 'transparent' }}
              >
                Cấu hình thô (rclone.conf)
              </button>
            </div>

            <form onSubmit={handleSaveRemote} className="space-y-4 text-sm">
              {remoteInputMode === 'form' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Tên Remote (Không viết dấu, khoảng cách):</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: googledrive, box_s3, dropbox"
                      disabled={!!editingRemoteName}
                      value={remoteName}
                      onChange={(e) => setRemoteName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                      className="input-glass w-full font-semibold"
                      style={{ padding: '8px' }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Dịch vụ đám mây:</label>
                    <select
                      value={remoteType}
                      onChange={(e) => {
                        setRemoteType(e.target.value);
                        setRemoteParams({});
                      }}
                      disabled={!!editingRemoteName}
                      className="input-glass w-full"
                      style={{ padding: '8px' }}
                    >
                      <option value="drive">Google Drive</option>
                      <option value="s3">Amazon S3 / Compatible (MinIO, R2, Spaces)</option>
                      <option value="onedrive">Microsoft OneDrive</option>
                      <option value="dropbox">Dropbox</option>
                      <option value="sftp">SFTP Connection</option>
                      <option value="ftp">FTP Connection</option>
                    </select>
                  </div>

                  {/* Google Drive parameters */}
                  {remoteType === 'drive' && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Client ID (Không bắt buộc):</label>
                        <input
                          type="text"
                          value={remoteParams.client_id || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, client_id: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Client Secret (Không bắt buộc):</label>
                        <input
                          type="password"
                          value={remoteParams.client_secret || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, client_secret: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Scope (Phạm vi truy cập):</label>
                        <select
                          value={remoteParams.scope || 'drive'}
                          onChange={(e) => setRemoteParams({ ...remoteParams, scope: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        >
                          <option value="drive">Truy cập đầy đủ (drive)</option>
                          <option value="drive.appfolder">Thư mục ứng dụng riêng (drive.appfolder)</option>
                          <option value="drive.readonly">Chỉ đọc (drive.readonly)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">OAuth Token (JSON từ `rclone authorize`):</label>
                        <textarea
                          rows="3"
                          placeholder='{"access_token":"ya29...","token_type":"Bearer","refresh_token":"...","expiry":"..."}'
                          value={remoteParams.token || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, token: e.target.value })}
                          className="input-glass w-full font-mono text-[10px]"
                          style={{ padding: '6px', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* S3 parameters */}
                  {remoteType === 's3' && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">S3 Provider:</label>
                        <select
                          value={remoteParams.provider || 'Minio'}
                          onChange={(e) => setRemoteParams({ ...remoteParams, provider: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        >
                          <option value="Minio">MinIO</option>
                          <option value="AWS">Amazon AWS S3</option>
                          <option value="Cloudflare">Cloudflare R2</option>
                          <option value="DigitalOcean">DigitalOcean Spaces</option>
                          <option value="Other">Khác (Other)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Access Key ID:</label>
                        <input
                          type="text"
                          required
                          value={remoteParams.access_key_id || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, access_key_id: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Secret Access Key:</label>
                        <input
                          type="password"
                          required
                          value={remoteParams.secret_access_key || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, secret_access_key: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Endpoint URL (Cho R2/MinIO/Spaces):</label>
                        <input
                          type="text"
                          placeholder="vd: https://<account_id>.r2.cloudflarestorage.com"
                          value={remoteParams.endpoint || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, endpoint: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Region (Không bắt buộc):</label>
                        <input
                          type="text"
                          placeholder="vd: us-east-1, auto"
                          value={remoteParams.region || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, region: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* OneDrive parameters */}
                  {remoteType === 'onedrive' && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Client ID:</label>
                        <input
                          type="text"
                          value={remoteParams.client_id || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, client_id: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Client Secret:</label>
                        <input
                          type="password"
                          value={remoteParams.client_secret || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, client_secret: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">OAuth Token JSON:</label>
                        <textarea
                          rows="3"
                          placeholder='{"access_token":"...","refresh_token":"..."}'
                          value={remoteParams.token || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, token: e.target.value })}
                          className="input-glass w-full font-mono text-[10px]"
                          style={{ padding: '6px', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* FTP/SFTP parameters */}
                  {(remoteType === 'ftp' || remoteType === 'sftp') && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Host/IP máy chủ nhận:</label>
                        <input
                          type="text"
                          required
                          value={remoteParams.host || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, host: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Port:</label>
                        <input
                          type="text"
                          required
                          value={remoteParams.port || (remoteType === 'sftp' ? '22' : '21')}
                          onChange={(e) => setRemoteParams({ ...remoteParams, port: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Username:</label>
                        <input
                          type="text"
                          required
                          value={remoteParams.user || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, user: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Password:</label>
                        <input
                          type="password"
                          required
                          value={remoteParams.pass || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, pass: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dropbox parameters */}
                  {remoteType === 'dropbox' && (
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Client ID:</label>
                        <input
                          type="text"
                          value={remoteParams.client_id || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, client_id: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">Client Secret:</label>
                        <input
                          type="password"
                          value={remoteParams.client_secret || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, client_secret: e.target.value })}
                          className="input-glass w-full text-xs"
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400 font-medium text-xs">OAuth Token:</label>
                        <textarea
                          rows="2"
                          placeholder="Dán Dropbox access token"
                          value={remoteParams.token || ''}
                          onChange={(e) => setRemoteParams({ ...remoteParams, token: e.target.value })}
                          className="input-glass w-full font-mono text-[10px]"
                          style={{ padding: '6px', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-gray-400 font-medium block">Cấu hình Raw (dạng file rclone.conf):</label>
                  <textarea
                    required
                    rows="8"
                    placeholder={`[myremote]\ntype = drive\nclient_id = ...\nclient_secret = ...\ntoken = {"access_token":"..."}`}
                    value={remoteRawConfig}
                    onChange={(e) => setRemoteRawConfig(e.target.value)}
                    className="input-glass w-full font-mono text-xs"
                    style={{ padding: '8px', resize: 'vertical' }}
                  />
                  <p className="text-[10px] text-gray-500">Cấu hình Raw bắt buộc phải chứa tên tiêu đề đặt trong ngoặc vuông `[tên_remote]` ở dòng đầu tiên.</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowRcloneModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Lưu cấu hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
