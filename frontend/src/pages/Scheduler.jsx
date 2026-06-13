import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Clock, 
  Calendar, 
  Trash2, 
  Plus, 
  Download, 
  RefreshCw, 
  Play, 
  Edit, 
  Check, 
  X, 
  AlertTriangle, 
  Database, 
  Folder, 
  FolderPlus, 
  Terminal,
  Save,
  RotateCcw
} from 'lucide-react';

export default function Scheduler() {
  const { apiCall, showToast, currentVPS, panelToken } = useVPS();
  const [activeTab, setActiveTab] = useState('cron');
  const [loading, setLoading] = useState(false);

  // States for Cron Jobs
  const [cronJobs, setCronJobs] = useState([]);
  const [showCronModal, setShowCronModal] = useState(false);
  const [editingCron, setEditingCron] = useState(null);
  
  // States for Backups
  const [backupFiles, setBackupFiles] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isManualBackup, setIsManualBackup] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);

  // Form states for Cron Job
  const [cronName, setCronName] = useState('');
  const [cronSchedule, setCronSchedule] = useState('0 2 * * *');
  const [cronCommand, setCronCommand] = useState('');
  const [cronActive, setCronActive] = useState(true);
  const [cronPreset, setCronPreset] = useState('daily');

  // Form states for Backup configuration
  const [backupType, setBackupType] = useState('dir'); // dir or mysql
  const [backupSourceDir, setBackupSourceDir] = useState('/var/www/');
  const [backupDatabase, setBackupDatabase] = useState('');
  const [backupDbUser, setBackupDbUser] = useState('root');
  const [backupDbPass, setBackupDbPass] = useState('');
  const [backupKeepCount, setBackupKeepCount] = useState(5);
  const [backupFrequency, setBackupFrequency] = useState('daily'); // hourly, daily, weekly, monthly
  const [backupCustomName, setBackupCustomName] = useState('');

  // Restore form state
  const [restorePath, setRestorePath] = useState('/var/www');
  const [restoreDbUser, setRestoreDbUser] = useState('root');
  const [restoreDbPass, setRestoreDbPass] = useState('');

  // Command Run Log State
  const [runLog, setRunLog] = useState(null);
  const [runningJob, setRunningJob] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'cron') {
        const res = await apiCall('/api/cron/list', 'POST');
        setCronJobs(res.data || []);
      } else if (activeTab === 'backup') {
        const fileRes = await apiCall('/api/backups/list', 'POST');
        setBackupFiles(fileRes.data || []);
        
        // Fetch databases list for backup dropdown
        try {
          const dbRes = await apiCall('/api/mysql/databases', 'POST');
          setDatabases(dbRes.data || []);
          if (dbRes.data && dbRes.data.length > 0 && !backupDatabase) {
            setBackupDatabase(dbRes.data[0]);
          }
        } catch (dbErr) {
          console.log('MySQL server may not be installed or active:', dbErr.message);
        }

        // Also fetch Cron Jobs to show backup schedules
        const cronRes = await apiCall('/api/cron/list', 'POST');
        setCronJobs(cronRes.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cron Job Helpers
  const handlePresetChange = (preset) => {
    setCronPreset(preset);
    if (preset === 'minute') setCronSchedule('* * * * *');
    else if (preset === 'hourly') setCronSchedule('0 * * * *');
    else if (preset === 'daily') setCronSchedule('0 2 * * *');
    else if (preset === 'weekly') setCronSchedule('0 2 * * 0');
    else if (preset === 'monthly') setCronSchedule('0 2 1 * *');
  };

  const handleOpenAddCron = () => {
    setEditingCron(null);
    setCronName('');
    setCronSchedule('0 2 * * *');
    setCronPreset('daily');
    setCronCommand('');
    setCronActive(true);
    setShowCronModal(true);
  };

  const handleOpenEditCron = (job) => {
    setEditingCron(job);
    setCronName(job.name);
    setCronSchedule(job.schedule);
    setCronPreset('custom');
    setCronCommand(job.command);
    setCronActive(job.active);
    setShowCronModal(true);
  };

  const handleSaveCron = async (e) => {
    e.preventDefault();
    if (!cronSchedule.trim() || !cronCommand.trim()) {
      showToast('Vui lòng nhập đầy đủ thông tin Lập lịch và Câu lệnh', 'warning');
      return;
    }

    try {
      if (editingCron) {
        await apiCall('/api/cron/edit', 'POST', {
          index: editingCron.index,
          name: cronName,
          schedule: cronSchedule,
          command: cronCommand,
          active: cronActive
        });
        showToast('Cập nhật tác vụ thành công', 'success');
      } else {
        await apiCall('/api/cron/add', 'POST', {
          name: cronName,
          schedule: cronSchedule,
          command: cronCommand,
          active: cronActive
        });
        showToast('Thêm tác vụ thành công', 'success');
      }
      setShowCronModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCron = async (job) => {
    try {
      const res = await apiCall('/api/cron/toggle', 'POST', { index: job.index });
      showToast(res.message, 'success');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCron = async (job) => {
    if (!window.confirm(`Bạn có chắc muốn xóa tác vụ "${job.name}"?`)) return;
    try {
      await apiCall('/api/cron/delete', 'POST', { index: job.index });
      showToast('Đã xóa tác vụ thành công', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestCron = async (command) => {
    setRunningJob(true);
    setRunLog('Đang thực thi lệnh trên VPS...');
    try {
      const res = await apiCall('/api/cron/run', 'POST', { command });
      let output = `[Exit Code: ${res.data.code}]\n`;
      if (res.data.stdout) output += `STDOUT:\n${res.data.stdout}\n`;
      if (res.data.stderr) output += `STDERR:\n${res.data.stderr}\n`;
      setRunLog(output || 'Lệnh đã chạy xong nhưng không có dữ liệu trả về.');
    } catch (err) {
      setRunLog(`Lỗi thực thi: ${err.message}`);
    } finally {
      setRunningJob(false);
    }
  };

  // Backups Helpers
  // Filter Cron Jobs to get backups schedules
  const getBackupSchedules = () => {
    return cronJobs.filter(job => job.name.startsWith('[BACKUP]'));
  };

  const parseBackupScheduleDetails = (job) => {
    const cmd = job.command;
    const type = cmd.includes('--type=dir') ? 'Mã nguồn' : 'MySQL Database';
    
    let target = 'Unknown';
    if (cmd.includes('--type=dir')) {
      const match = cmd.match(/--source=(\S+)/);
      target = match ? match[1] : 'Thư mục';
    } else {
      const match = cmd.match(/--database=(\S+)/);
      target = match ? match[1] : 'MySQL';
    }

    let keep = 5;
    const keepMatch = cmd.match(/--keep=(\d+)/);
    if (keepMatch) keep = parseInt(keepMatch[1]);

    return { type, target, keep };
  };

  const handleAddBackupSchedule = async (e) => {
    e.preventDefault();
    
    let command = '';
    let name = '';
    let cronTime = '';

    // Convert frequency to cron schedule
    if (backupFrequency === 'hourly') cronTime = '0 * * * *';
    else if (backupFrequency === 'daily') cronTime = '0 2 * * *';
    else if (backupFrequency === 'weekly') cronTime = '0 2 * * 0';
    else if (backupFrequency === 'monthly') cronTime = '0 2 1 * *';

    if (backupType === 'dir') {
      if (!backupSourceDir.trim()) {
        showToast('Vui lòng nhập đường dẫn thư mục nguồn', 'warning');
        return;
      }
      const dirName = backupCustomName.trim() || backupSourceDir.split('/').filter(Boolean).pop() || 'web';
      name = `[BACKUP] dir - ${dirName}`;
      command = `/bin/bash /var/www/vps-manager-backups/backup-runner.sh --type=dir --source=${backupSourceDir.trim()} --keep=${backupKeepCount} --name=${dirName}`;
    } else {
      if (!backupDatabase) {
        showToast('Vui lòng chọn Database cần sao lưu', 'warning');
        return;
      }
      name = `[BACKUP] mysql - ${backupDatabase}`;
      command = `/bin/bash /var/www/vps-manager-backups/backup-runner.sh --type=mysql --database=${backupDatabase} --keep=${backupKeepCount}`;
      if (backupDbUser) command += ` --db-user=${backupDbUser}`;
      if (backupDbPass) command += ` --db-pass=${backupDbPass}`;
    }

    try {
      if (isManualBackup) {
        // Run manual backup immediately
        showToast('Đang chạy sao lưu dữ liệu...', 'info');
        const manualType = backupType;
        const bodyData = {
          type: manualType,
          keep: backupKeepCount
        };
        if (manualType === 'dir') {
          bodyData.source = backupSourceDir.trim();
          bodyData.name = backupCustomName.trim() || backupSourceDir.split('/').filter(Boolean).pop() || 'web';
        } else {
          bodyData.database = backupDatabase;
          bodyData.dbUser = backupDbUser;
          bodyData.dbPass = backupDbPass;
        }

        const res = await apiCall('/api/backups/create', 'POST', bodyData);
        showToast(res.message, 'success');
      } else {
        // Save backup schedule in Cron
        await apiCall('/api/cron/add', 'POST', {
          name,
          schedule: cronTime,
          command,
          active: true
        });
        showToast('Đã lập lịch sao lưu tự động thành công!', 'success');
      }

      setShowBackupModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      showToast(`Đang kết nối để tải file ${filename}...`, 'info');
      
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
      
      showToast('Đã tải xuống file sao lưu!', 'success');
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

  const handleOpenRestore = (backup) => {
    setSelectedBackup(backup);
    if (backup.type === 'dir') {
      // Guess restore path by directory name
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

    try {
      showToast('Đang tiến hành khôi phục dữ liệu trên VPS...', 'info');
      const res = await apiCall('/api/backups/restore', 'POST', {
        filename: selectedBackup.filename,
        restorePath: selectedBackup.type === 'dir' ? restorePath.trim() : undefined,
        dbUser: selectedBackup.type === 'mysql' ? restoreDbUser : undefined,
        dbPass: selectedBackup.type === 'mysql' ? restoreDbPass : undefined
      });
      showToast(res.message, 'success');
      setShowRestoreModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Lập lịch & Sao lưu</h1>
          <p className="text-sm text-gray-400">Tự động hóa các tác vụ hệ thống thông qua Cron Jobs và thiết lập kế hoạch sao lưu dữ liệu tự động.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'cron' ? (
            <button onClick={handleOpenAddCron} className="btn btn-primary flex items-center gap-2">
              <Plus size={16} /> Thêm tác vụ
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => { setIsManualBackup(true); setBackupType('dir'); setShowBackupModal(true); }} 
                className="btn btn-glass flex items-center gap-2 text-green-300"
              >
                <Plus size={16} /> Sao lưu thủ công
              </button>
              <button 
                onClick={() => { setIsManualBackup(false); setBackupType('dir'); setShowBackupModal(true); }} 
                className="btn btn-primary flex items-center gap-2"
              >
                <Clock size={16} /> Thêm lịch sao lưu
              </button>
            </div>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-glass flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 pb-px" style={{ display: 'flex', gap: '24px' }}>
        <button
          onClick={() => setActiveTab('cron')}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
            activeTab === 'cron'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
          style={{ background: 'none', cursor: 'pointer' }}
        >
          <span className="flex items-center gap-2">
            <Clock size={16} /> Tác vụ Lập lịch (Cron)
          </span>
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all ${
            activeTab === 'backup'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
          style={{ background: 'none', cursor: 'pointer' }}
        >
          <span className="flex items-center gap-2">
            <Database size={16} /> Sao lưu & Khôi phục
          </span>
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="card-glass p-8 text-center text-gray-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang truy xuất cấu hình trên VPS...
        </div>
      )}

      {/* Tab 1: Cron Jobs */}
      {!loading && activeTab === 'cron' && (
        <div className="card-glass overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase font-mono text-[11px] tracking-wider">
                  <th className="p-4" style={{ width: '40px' }}>STT</th>
                  <th className="p-4">Tên tác vụ</th>
                  <th className="p-4">Chu kỳ (Cron)</th>
                  <th className="p-4">Câu lệnh trên VPS</th>
                  <th className="p-4 text-center" style={{ width: '100px' }}>Trạng thái</th>
                  <th className="p-4 text-right" style={{ width: '180px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cronJobs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">
                      Chưa có tác vụ lập lịch nào được thiết lập. Hãy bấm nút Thêm tác vụ để bắt đầu!
                    </td>
                  </tr>
                ) : (
                  cronJobs.map((job, idx) => (
                    <tr key={job.index} className="hover:bg-white/[0.01] transition-all">
                      <td className="p-4 font-mono text-gray-500">{idx + 1}</td>
                      <td className="p-4 font-semibold text-gray-200">{job.name}</td>
                      <td className="p-4 font-mono text-indigo-400">{job.schedule}</td>
                      <td className="p-4 font-mono text-gray-300 text-xs truncate max-w-[250px]" title={job.command}>
                        {job.command}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleCron(job)}
                          className={`status-badge cursor-pointer ${job.active ? 'success' : 'danger'}`}
                          style={{ border: 'none', cursor: 'pointer' }}
                        >
                          {job.active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleTestCron(job.command)}
                            className="btn btn-glass btn-sm text-green-400"
                            title="Chạy thử tức thì"
                            style={{ padding: '6px' }}
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEditCron(job)}
                            className="btn btn-glass btn-sm text-blue-400"
                            title="Chỉnh sửa"
                            style={{ padding: '6px' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCron(job)}
                            className="btn btn-glass btn-sm text-red-400"
                            title="Xóa"
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

      {/* Tab 2: Backups */}
      {!loading && activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Section A: Backup Schedules */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar size={18} className="text-indigo-400" />
              Lịch sao lưu tự động định kỳ
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase font-mono text-[11px] tracking-wider">
                    <th className="p-3">Loại</th>
                    <th className="p-3">Chu kỳ</th>
                    <th className="p-3">Đối tượng sao lưu</th>
                    <th className="p-3">Số bản sao giữ lại</th>
                    <th className="p-3 text-center" style={{ width: '100px' }}>Trạng thái</th>
                    <th className="p-3 text-right" style={{ width: '100px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {getBackupSchedules().length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-gray-400">
                        Chưa có lịch sao lưu tự động nào được đăng ký.
                      </td>
                    </tr>
                  ) : (
                    getBackupSchedules().map((job) => {
                      const details = parseBackupScheduleDetails(job);
                      return (
                        <tr key={job.index} className="hover:bg-white/[0.01]">
                          <td className="p-3 font-semibold text-gray-300">
                            {details.type === 'Mã nguồn' ? (
                              <span className="flex items-center gap-2"><Folder size={14} className="text-amber-400" /> Mã nguồn</span>
                            ) : (
                              <span className="flex items-center gap-2"><Database size={14} className="text-indigo-400" /> MySQL DB</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-indigo-400">{job.schedule}</td>
                          <td className="p-3 font-mono text-gray-300">{details.target}</td>
                          <td className="p-3 text-gray-300">{details.keep} bản gần nhất</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleCron(job)}
                              className={`status-badge cursor-pointer ${job.active ? 'success' : 'danger'}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              {job.active ? 'Hoạt động' : 'Tạm dừng'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteCron(job)}
                              className="btn btn-glass btn-sm text-red-400"
                              style={{ padding: '6px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Backup Files */}
          <div className="card-glass p-6 rounded-xl space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderPlus size={18} className="text-green-400" />
              Kho lưu trữ các bản sao lưu hiện tại trên VPS
            </h2>
            <p className="text-xs text-gray-400">Các file được lưu trữ trong thư mục cục bộ bảo mật của VPS: <code className="text-indigo-300">/var/www/vps-manager-backups/</code></p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase font-mono text-[11px] tracking-wider">
                    <th className="p-3">Tên file</th>
                    <th className="p-3">Loại</th>
                    <th className="p-3">Tên gốc</th>
                    <th className="p-3">Kích thước</th>
                    <th className="p-3">Thời gian tạo</th>
                    <th className="p-3 text-right" style={{ width: '180px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {backupFiles.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-gray-400">
                        Thư mục sao lưu trống. Chưa có tệp sao lưu nào được tạo.
                      </td>
                    </tr>
                  ) : (
                    backupFiles.map((file) => (
                      <tr key={file.filename} className="hover:bg-white/[0.01]">
                        <td className="p-3 font-mono text-xs text-gray-300 truncate max-w-[200px]" title={file.filename}>
                          {file.filename}
                        </td>
                        <td className="p-3">
                          {file.type === 'dir' ? (
                            <span className="badge text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded text-xs">Folder</span>
                          ) : (
                            <span className="badge text-indigo-300 bg-indigo-400/10 px-2 py-0.5 rounded text-xs">MySQL</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-gray-400">{file.targetName}</td>
                        <td className="p-3 text-gray-300">{file.size}</td>
                        <td className="p-3 text-gray-300 text-xs">{file.createdAt}</td>
                        <td className="p-3 text-right">
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenRestore(file)}
                              className="btn btn-glass btn-sm text-green-300 flex items-center gap-1"
                              title="Khôi phục dữ liệu đè lên thư mục hoặc DB"
                            >
                              <RotateCcw size={12} /> Khôi phục
                            </button>
                            <button
                              onClick={() => handleDownloadBackup(file.filename)}
                              className="btn btn-glass btn-sm text-indigo-300"
                              title="Tải về máy tính"
                              style={{ padding: '6px' }}
                            >
                              <Download size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(file.filename)}
                              className="btn btn-glass btn-sm text-red-400"
                              title="Xóa khỏi VPS"
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
        </div>
      )}

      {/* Terminal run logs area if user ran a test */}
      {runLog && (
        <div className="card-glass p-5 rounded-xl space-y-3">
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-green-400">
              <Terminal size={16} /> Kết quả chạy thử tác vụ
            </h3>
            <button onClick={() => setRunLog(null)} className="btn btn-glass btn-sm" style={{ padding: '2px 8px' }}>
              Đóng log
            </button>
          </div>
          <pre className="p-4 bg-black/60 text-emerald-400 font-mono text-xs rounded-lg max-h-[300px] overflow-y-auto whitespace-pre-wrap border border-white/5">
            {runLog}
          </pre>
        </div>
      )}

      {/* MODAL 1: Add/Edit Cron Job */}
      {showCronModal && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200">
                {editingCron ? 'Cập nhật Tác vụ lập lịch' : 'Thêm Tác vụ lập lịch mới'}
              </h2>
              <button onClick={() => setShowCronModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCron} className="space-y-4 text-sm">
              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Tên tác vụ:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Dọn dẹp Cache, Gửi mail..."
                  value={cronName}
                  onChange={(e) => setCronName(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Chọn chu kỳ mẫu:</label>
                <select
                  value={cronPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                >
                  <option value="minute">Mỗi phút (* * * * *)</option>
                  <option value="hourly">Mỗi giờ (0 * * * *)</option>
                  <option value="daily">Hàng ngày lúc 2:00 AM (0 2 * * *)</option>
                  <option value="weekly">Hàng tuần vào Chủ nhật (0 2 * * 0)</option>
                  <option value="monthly">Hàng tháng vào ngày 1 (0 2 1 * *)</option>
                  <option value="custom">Tùy chỉnh biểu thức Cron</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Biểu thức Cron:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: * * * * *"
                  value={cronSchedule}
                  onChange={(e) => { setCronSchedule(e.target.value); setCronPreset('custom'); }}
                  className="input-glass w-full font-mono text-indigo-300"
                  style={{ padding: '8px' }}
                />
                <p className="text-[10px] text-gray-400">Cấu trúc: Phút | Giờ | Ngày trong tháng | Tháng | Ngày trong tuần (0-6)</p>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Câu lệnh Bash thực thi:</label>
                <textarea
                  required
                  rows="3"
                  placeholder="VD: rm -rf /var/www/site/cache/*"
                  value={cronCommand}
                  onChange={(e) => setCronCommand(e.target.value)}
                  className="input-glass w-full font-mono text-xs"
                  style={{ padding: '8px', resize: 'vertical' }}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cron_active"
                  checked={cronActive}
                  onChange={(e) => setCronActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="cron_active" className="text-gray-200 cursor-pointer">Kích hoạt tác vụ này</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCronModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save size={16} /> Lưu cấu hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Backup Schedule / Manual Backup */}
      {showBackupModal && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200">
                {isManualBackup ? 'Tạo bản sao lưu dữ liệu tức thì' : 'Đăng ký Lập lịch sao lưu tự động'}
              </h2>
              <button onClick={() => setShowBackupModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddBackupSchedule} className="space-y-4 text-sm">
              <div className="space-y-2">
                <label className="text-gray-400 font-medium block">Loại hình sao lưu:</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label className="flex items-center gap-2 text-gray-200 cursor-pointer">
                    <input 
                      type="radio" 
                      name="backup_type" 
                      value="dir" 
                      checked={backupType === 'dir'}
                      onChange={() => setBackupType('dir')}
                      style={{ cursor: 'pointer' }}
                    />
                    Thư mục mã nguồn
                  </label>
                  <label className="flex items-center gap-2 text-gray-200 cursor-pointer">
                    <input 
                      type="radio" 
                      name="backup_type" 
                      value="mysql" 
                      checked={backupType === 'mysql'}
                      onChange={() => setBackupType('mysql')}
                      style={{ cursor: 'pointer' }}
                    />
                    Cơ sở dữ liệu MySQL
                  </label>
                </div>
              </div>

              {backupType === 'dir' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Thư mục nguồn cần nén:</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: /var/www/my-site"
                      value={backupSourceDir}
                      onChange={(e) => setBackupSourceDir(e.target.value)}
                      className="input-glass w-full"
                      style={{ padding: '8px' }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Tên định danh (Không bắt buộc):</label>
                    <input
                      type="text"
                      placeholder="Mặc định lấy tên thư mục cuối"
                      value={backupCustomName}
                      onChange={(e) => setBackupCustomName(e.target.value)}
                      className="input-glass w-full"
                      style={{ padding: '8px' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-gray-400 font-medium">Chọn Database cần backup:</label>
                    {databases.length === 0 ? (
                      <div className="p-2 border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 rounded text-xs">
                        Không quét thấy database nào của người dùng. (Hoặc MySQL chưa được cài đặt)
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
                  <div className="space-y-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="space-y-1">
                      <label className="text-gray-400 font-medium">User truy cập DB:</label>
                      <input
                        type="text"
                        value={backupDbUser}
                        onChange={(e) => setBackupDbUser(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-gray-400 font-medium">Mật khẩu User:</label>
                      <input
                        type="password"
                        placeholder="Để trống nếu không có"
                        value={backupDbPass}
                        onChange={(e) => setBackupDbPass(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-400 font-medium">Số lượng bản backup lưu giữ tối đa (Pruning):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={backupKeepCount}
                  onChange={(e) => setBackupKeepCount(parseInt(e.target.value) || 5)}
                  className="input-glass w-full"
                  style={{ padding: '8px' }}
                />
                <p className="text-[10px] text-gray-400">Hệ thống sẽ giữ tối đa {backupKeepCount} file backup gần nhất và tự xóa file cũ.</p>
              </div>

              {!isManualBackup && (
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Tần suất tự động chạy:</label>
                  <select
                    value={backupFrequency}
                    onChange={(e) => setBackupFrequency(e.target.value)}
                    className="input-glass w-full"
                    style={{ padding: '8px' }}
                  >
                    <option value="hourly">Hàng giờ (Bút 0 hàng giờ)</option>
                    <option value="daily">Hàng ngày (Vào 2:00 AM sáng)</option>
                    <option value="weekly">Hàng tuần (Vào 2:00 AM sáng Chủ nhật)</option>
                    <option value="monthly">Hàng tháng (Vào 2:00 AM sáng Ngày 1 đầu tháng)</option>
                  </select>
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
                  disabled={backupType === 'mysql' && databases.length === 0}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save size={16} /> {isManualBackup ? 'Bắt đầu sao lưu' : 'Lập lịch tự động'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Restore Confirmation */}
      {showRestoreModal && selectedBackup && (
        <div className="modal-overlay">
          <div className="modal-content card-glass p-6 max-w-md w-full rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <AlertTriangle className="text-red-400" size={20} />
                Khôi phục Dữ liệu Cảnh báo
              </h2>
              <button onClick={() => setShowRestoreModal(false)} className="text-gray-400 hover:text-white" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              Bạn đang yêu cầu khôi phục dữ liệu từ tệp: <br />
              <strong className="text-indigo-300 font-mono text-xs">{selectedBackup.filename}</strong>
            </p>
            <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded">
              Cảnh báo: Thao tác này sẽ ghi đè toàn bộ tệp hoặc cơ sở dữ liệu hiện tại bằng dữ liệu trong bản sao lưu này. Hãy đảm bảo bạn hiểu rõ trước khi bấm khôi phục!
            </p>

            <form onSubmit={handleRestoreBackup} className="space-y-4 text-sm">
              {selectedBackup.type === 'dir' ? (
                <div className="space-y-1">
                  <label className="text-gray-400 font-medium">Giải nén khôi phục vào thư mục gốc:</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: /var/www/my-site"
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    className="input-glass w-full"
                    style={{ padding: '8px' }}
                  />
                  <p className="text-[10px] text-gray-400">Nội dung nén sẽ được giải nén trực tiếp đè vào thư mục này.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Database đích: <strong className="text-indigo-300">{selectedBackup.targetName}</strong> (Tự động khởi tạo nếu chưa có)</p>
                  <div className="space-y-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="space-y-1">
                      <label className="text-gray-400 font-medium">User DB:</label>
                      <input
                        type="text"
                        value={restoreDbUser}
                        onChange={(e) => setRestoreDbUser(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-gray-400 font-medium">Mật khẩu User:</label>
                      <input
                        type="password"
                        placeholder="Để trống nếu không cần"
                        value={restoreDbPass}
                        onChange={(e) => setRestoreDbPass(e.target.value)}
                        className="input-glass w-full"
                        style={{ padding: '8px' }}
                      />
                    </div>
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
                  className="btn btn-danger"
                >
                  Đồng ý Khôi phục
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
