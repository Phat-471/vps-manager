import React, { useState, useEffect, useRef } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Clock, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Play, 
  Edit, 
  X, 
  Terminal,
  Save
} from 'lucide-react';

export default function Scheduler() {
  const { apiCall, showToast, currentVPS, socket, isConnected } = useVPS();
  const [loading, setLoading] = useState(false);

  // States for Cron Jobs
  const [cronJobs, setCronJobs] = useState([]);
  const [showCronModal, setShowCronModal] = useState(false);
  const [editingCron, setEditingCron] = useState(null);

  // Form states for Cron Job
  const [cronName, setCronName] = useState('');
  const [cronSchedule, setCronSchedule] = useState('0 2 * * *');
  const [cronCommand, setCronCommand] = useState('');
  const [cronActive, setCronActive] = useState(true);
  const [cronPreset, setCronPreset] = useState('daily');

  // Command Run Log State
  const [runLog, setRunLog] = useState(null);
  const [runningJob, setRunningJob] = useState(false);
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
  }, [isConnected, currentVPS]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/cron/list', 'POST');
      setCronJobs(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách Cron:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const runTaskStream = (command, onComplete = () => {}) => {
    if (!socket) {
      showToast('Kết nối WebSocket chưa sẵn sàng', 'error');
      return;
    }
    setRunningJob(true);
    setRunLog(`[Task Runner] Khởi động tác vụ...\nLệnh: ${command}\n\n`);

    socket.off('task:output');
    socket.off('task:ended');

    socket.on('task:output', (data) => {
      setRunLog(prev => (prev || '') + data);
    });

    socket.on('task:ended', ({ code, error }) => {
      setRunningJob(false);
      if (error) {
        setRunLog(prev => (prev || '') + `\n[LỖI] ${error}\n`);
        showToast(`Tác vụ thất bại: ${error}`, 'error');
      } else {
        setRunLog(prev => (prev || '') + `\n[Tác vụ hoàn tất với mã thoát: ${code}]\n`);
        showToast('Tác vụ thực thi hoàn tất!', 'success');
      }
      socket.off('task:output');
      socket.off('task:ended');
      onComplete(code, error);
    });

    socket.emit('task:run', { vpsConfig: currentVPS, command });
  };

  const handleTestCron = async (command) => {
    runTaskStream(`timeout 60 ${command}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="explorer-header flex justify-between items-center">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Lập lịch Cron Jobs (Scheduler)</h1>
          <p className="text-sm text-gray-400">Tự động hóa các tác vụ định kỳ trên VPS thông qua trình quản lý Crontab của Linux.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleOpenAddCron} className="btn btn-primary flex items-center gap-1.5">
            <Plus size={16} /> Thêm tác vụ mới
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn btn-glass flex items-center gap-1.5"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && cronJobs.length === 0 && (
        <div className="card-glass p-8 text-center text-gray-400">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
          Đang truy xuất danh sách Cron Jobs...
        </div>
      )}

      {/* Cron Jobs Table */}
      {!loading && (
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
                      Chưa có tác vụ lập lịch nào được thiết lập. Hãy bấm nút "Thêm tác vụ mới" để bắt đầu!
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

      {/* Terminal run logs area if user ran a test */}
      {runLog && (
        <div className="card-glass p-5 rounded-xl space-y-3 animate-fade-in">
          <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-green-400">
              <Terminal size={16} /> Kết quả chạy thử tác vụ
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

      {/* MODAL: Add/Edit Cron Job */}
      {showCronModal && (
        <div className="modal-overlay animate-fade-in">
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
                  className="input-glass w-full font-semibold"
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
                <p className="text-[10px] text-gray-500">Cấu trúc: Phút | Giờ | Ngày trong tháng | Tháng | Ngày trong tuần (0-6)</p>
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
    </div>
  );
}
