import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { Play, Square, RotateCw, Trash2, FileText, Layers, RefreshCw, Terminal } from 'lucide-react';

export default function Docker() {
  const { apiCall, showToast } = useVPS();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasDocker, setHasDocker] = useState(true);

  // Logs modal
  const [selectedContainerLogs, setSelectedContainerLogs] = useState(null);
  const [logsText, setLogsText] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/docker/list', 'POST');
      setContainers(res.data || []);
      setHasDocker(true);
    } catch (err) {
      console.error(err);
      if (err.message?.includes('not found') || err.message?.includes('Docker not found')) {
        setHasDocker(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action, id, name) => {
    try {
      showToast(`Đang thực hiện ${action} cho container: ${name}...`, 'info');
      await apiCall(`/api/docker/${action}`, 'POST', { id });
      showToast(`Thao tác ${action} container thành công!`, 'success');
      fetchContainers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cưỡng chế (rm -f) Container "${name}"?`)) return;
    try {
      await apiCall('/api/docker/remove', 'POST', { id });
      showToast(`Đã xóa container ${name}`, 'success');
      fetchContainers();
    } catch (err) {
      console.error(err);
    }
  };

  const viewLogs = async (id, name) => {
    setSelectedContainerLogs(name);
    setLogsLoading(true);
    setLogsText('');
    try {
      const res = await apiCall('/api/docker/logs', 'POST', { id });
      setLogsText(res.data?.logs || 'Không có log.');
    } catch (err) {
      console.error(err);
      setSelectedContainerLogs(null);
    } finally {
      setLogsLoading(false);
    }
  };

  const pruneSystem = async () => {
    if (!window.confirm('Bạn có muốn dọn dẹp hệ thống Docker? Tất cả container đã dừng, mạng thừa, và cache build sẽ bị xóa!')) return;
    try {
      showToast('Đang chạy docker system prune...', 'info');
      await apiCall('/api/docker/prune', 'POST');
      showToast('Đã dọn dẹp Docker thành công!', 'success');
      fetchContainers();
    } catch (err) {
      console.error(err);
    }
  };

  const isRunning = (status) => {
    return status?.toLowerCase().includes('up');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Docker Containers</h1>
          <p className="text-sm text-gray-400">Giám sát và vận hành các Docker Container hoạt động trên VPS</p>
        </div>
        <div className="flex items-center gap-2">
          {hasDocker && (
            <button
              onClick={pruneSystem}
              className="btn-glass px-3 py-2 text-sm rounded-lg text-yellow-400 border border-yellow-500/20"
            >
              Dọn dẹp Docker
            </button>
          )}
          <button
            onClick={fetchContainers}
            disabled={loading}
            className="btn-glass flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {!hasDocker ? (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 rounded-xl space-y-2 text-sm">
          <span className="font-bold">Docker chưa được cài đặt hoặc chưa khởi động trên VPS!</span>
          <p className="text-gray-400">Vui lòng truy cập Scripts hoặc Terminal để thực hiện cài đặt Docker engine trước khi quản lý.</p>
        </div>
      ) : (
        <div className="card-glass overflow-hidden rounded-xl">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Đang đọc thông tin Docker...</div>
          ) : containers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Không tìm thấy container nào đang vận hành.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs uppercase">
                    <th className="p-3">Tên container</th>
                    <th className="p-3">Image gốc</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Ports mappings</th>
                    <th className="p-3 text-center w-36">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {containers.map((c) => {
                    const active = isRunning(c.status);
                    return (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <Layers size={18} className="text-indigo-400 shrink-0" />
                            <div>
                              <span className="font-semibold block text-gray-200">{c.name}</span>
                              <span className="text-xs text-gray-400 font-mono">{c.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-300 max-w-[200px] truncate" title={c.image}>
                          {c.image}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            active ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-400 max-w-[200px] truncate" title={c.ports}>
                          {c.ports || '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            {active ? (
                              <button
                                onClick={() => handleAction('stop', c.id, c.name)}
                                title="Dừng container"
                                className="p-1.5 hover:bg-white/10 rounded text-yellow-400"
                              >
                                <Square size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction('start', c.id, c.name)}
                                title="Chạy container"
                                className="p-1.5 hover:bg-white/10 rounded text-green-400"
                              >
                                <Play size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleAction('restart', c.id, c.name)}
                              title="Restart"
                              className="p-1.5 hover:bg-white/10 rounded text-blue-400"
                            >
                              <RotateCw size={14} />
                            </button>
                            <button
                              onClick={() => viewLogs(c.id, c.name)}
                              title="Xem Logs"
                              className="p-1.5 hover:bg-white/10 rounded text-indigo-400"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              onClick={() => handleRemove(c.id, c.name)}
                              title="Xóa Container"
                              className="p-1.5 hover:bg-white/10 rounded text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logs Modal */}
      {selectedContainerLogs && (
        <div className="modal-overlay">
          <div className="card-glass w-full max-w-4xl p-6 rounded-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Terminal size={18} className="text-indigo-400" />
                Logs: {selectedContainerLogs}
              </h3>
              <button onClick={() => setSelectedContainerLogs(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-auto bg-black/60 font-mono text-xs text-gray-300 p-4 rounded-lg min-h-[300px]">
              {logsLoading ? 'Đang đọc log Docker...' : <pre className="whitespace-pre-wrap">{logsText}</pre>}
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
              <button
                onClick={() => setSelectedContainerLogs(null)}
                className="btn-glass px-4 py-2 rounded-lg text-xs bg-white/5"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
