import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  FileText, 
  Layers, 
  RefreshCw, 
  Terminal, 
  Plus, 
  Download, 
  Image as ImageIcon, 
  X, 
  PlusCircle, 
  Settings, 
  ShieldAlert 
} from 'lucide-react';

export default function Docker() {
  const { apiCall, showToast, isConnected } = useVPS();
  const [activeTab, setActiveTab] = useState('containers'); // 'containers' | 'images'
  const [containers, setContainers] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [hasDocker, setHasDocker] = useState(true);

  // Logs modal state
  const [selectedContainerLogs, setSelectedContainerLogs] = useState(null);
  const [logsText, setLogsText] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);

  // Wizard deploy container modal state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  
  // Deploy Form states
  const [containerName, setContainerName] = useState('');
  const [imageName, setImageName] = useState('');
  const [restartPolicy, setRestartPolicy] = useState('always');
  const [portsList, setPortsList] = useState([{ host: '', container: '' }]);
  const [volumesList, setVolumesList] = useState([{ host: '', container: '' }]);
  const [envList, setEnvList] = useState([{ key: '', value: '' }]);

  // Pull Image modal state
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullImageName, setPullImageName] = useState('');
  const [pullLoading, setPullLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      fetchData();
    }
  }, [isConnected, activeTab]);

  const fetchData = () => {
    if (activeTab === 'containers') {
      fetchContainers();
    } else {
      fetchImages();
    }
  };

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

  const fetchImages = async () => {
    setImagesLoading(true);
    try {
      const res = await apiCall('/api/docker/images', 'POST');
      setImages(res.data || []);
      setHasDocker(true);
    } catch (err) {
      console.error(err);
      if (err.message?.includes('not found') || err.message?.includes('Docker not found')) {
        setHasDocker(false);
      }
    } finally {
      setImagesLoading(false);
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
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveImage = async (id, repo, tag) => {
    const targetName = tag && tag !== '<none>' ? `${repo}:${tag}` : id;
    if (!window.confirm(`Bạn có chắc muốn xóa Docker Image "${targetName}"?`)) return;
    try {
      showToast(`Đang xóa image ${targetName}...`, 'info');
      await apiCall('/api/docker/remove-image', 'POST', { id: repo === '<none>' ? id : targetName });
      showToast(`Đã xóa image thành công!`, 'success');
      fetchImages();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePullImage = async (e) => {
    e.preventDefault();
    if (!pullImageName.trim()) return;
    setPullLoading(true);
    showToast(`Đang tải Docker Image "${pullImageName}" từ Docker Hub (quá trình có thể chạy ngầm trong vài chục giây)...`, 'info');
    try {
      const res = await apiCall('/api/docker/pull', 'POST', { image: pullImageName.trim() });
      if (res.success) {
        showToast(`Tải Docker Image "${pullImageName}" thành công!`, 'success');
        setShowPullModal(false);
        setPullImageName('');
        fetchImages();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPullLoading(false);
    }
  };

  const handleDeploySubmit = async (e) => {
    e.preventDefault();
    if (!imageName.trim()) {
      showToast('Vui lòng điền tên Docker Image', 'warning');
      return;
    }

    setDeployLoading(true);
    showToast('Đang thực thi khởi tạo và deploy container...', 'info');

    // Reconstruct list arrays
    const formattedPorts = portsList
      .filter(p => p.container.trim())
      .map(p => p.host.trim() ? `${p.host.trim()}:${p.container.trim()}` : p.container.trim());

    const formattedVolumes = volumesList
      .filter(v => v.host.trim() && v.container.trim())
      .map(v => `${v.host.trim()}:${v.container.trim()}`);

    const formattedEnv = envList
      .filter(env => env.key.trim());

    try {
      const res = await apiCall('/api/docker/deploy', 'POST', {
        name: containerName.trim(),
        image: imageName.trim(),
        restart: restartPolicy,
        ports: formattedPorts,
        volumes: formattedVolumes,
        env: formattedEnv
      });

      if (res.success) {
        showToast('Khởi chạy Docker Container thành công!', 'success');
        setShowDeployModal(false);
        // Reset deploy form
        setContainerName('');
        setImageName('');
        setRestartPolicy('always');
        setPortsList([{ host: '', container: '' }]);
        setVolumesList([{ host: '', container: '' }]);
        setEnvList([{ key: '', value: '' }]);
        fetchContainers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeployLoading(false);
    }
  };

  const isRunning = (status) => {
    return status?.toLowerCase().includes('up');
  };

  // Helper dynamic row mutations
  const updateRow = (list, setList, index, field, value) => {
    const updated = [...list];
    updated[index][field] = value;
    setList(updated);
  };

  const addRow = (list, setList, defaultObj) => {
    setList([...list, defaultObj]);
  };

  const removeRow = (list, setList, index) => {
    if (list.length === 1) return; // Keep at least one row
    const updated = list.filter((_, idx) => idx !== index);
    setList(updated);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Quản trị Docker Containers
          </h1>
          <p className="text-sm text-gray-400">Giám sát container, quản lý Docker Images và triển khai ứng dụng độc lập</p>
        </div>
        <div className="explorer-toolbar">
          {hasDocker && (
            <>
              <button
                onClick={() => setShowPullModal(true)}
                className="btn btn-glass text-indigo-300"
              >
                <Download size={14} /> Pull Image
              </button>
              <button
                onClick={() => setShowDeployModal(true)}
                className="btn btn-primary"
              >
                <Plus size={14} /> Triển khai Container
              </button>
            </>
          )}
          <button
            onClick={fetchData}
            disabled={loading || imagesLoading}
            className="btn btn-glass"
          >
            <RefreshCw size={14} className={(loading || imagesLoading) ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="db-tabs-container">
        <button 
          className={`db-tab-item ${activeTab === 'containers' ? 'active' : ''}`}
          onClick={() => setActiveTab('containers')}
        >
          <Layers size={16} />
          Container ({containers.length})
        </button>
        <button 
          className={`db-tab-item ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          <ImageIcon size={16} />
          Docker Images ({images.length})
        </button>
      </div>

      {!hasDocker ? (
        <div className="db-warning-card">
          <ShieldAlert className="db-warning-icon text-yellow-500" size={24} />
          <div className="db-warning-text">
            <strong className="db-warning-title text-yellow-400" style={{ fontSize: '14px' }}>
              Docker chưa được cài đặt hoặc chưa khởi động trên VPS!
            </strong>
            <p className="text-gray-400" style={{ marginTop: '4px' }}>
              Vui lòng chuyển đến mục <strong>Cài đặt Dịch vụ</strong> để cài đặt Docker Engine trước khi có thể quản lý qua bảng điều khiển này.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: CONTAINERS */}
          {activeTab === 'containers' && (
            <div className="card-glass overflow-hidden rounded-xl">
              {loading ? (
                <div className="text-center py-12 text-gray-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  Đang đọc thông tin Docker containers...
                </div>
              ) : containers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Không tìm thấy container nào đang vận hành.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="explorer-list-table">
                    <thead>
                      <tr>
                        <th>Tên container</th>
                        <th>Image gốc</th>
                        <th>Trạng thái</th>
                        <th>Ports mappings</th>
                        <th style={{ textAlign: 'center', width: '200px' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {containers.map((c) => {
                        const active = isRunning(c.status);
                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="explorer-list-name-col">
                                <Layers size={16} className="text-indigo-400 shrink-0" />
                                <div>
                                  <span className="font-semibold block text-gray-200">{c.name}</span>
                                  <span className="text-[10px] text-gray-400 font-mono">{c.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="font-mono text-xs text-gray-300 max-w-[200px] truncate" title={c.image}>
                              {c.image}
                            </td>
                            <td>
                              <span className={`status-badge ${active ? 'success' : 'danger'}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="font-mono text-xs text-gray-400 max-w-[200px] truncate" title={c.ports}>
                              {c.ports || '-'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                {active ? (
                                  <button
                                    onClick={() => handleAction('stop', c.id, c.name)}
                                    title="Dừng container"
                                    className="btn btn-glass btn-sm text-yellow-400"
                                    style={{ padding: '6px' }}
                                  >
                                    <Square size={12} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleAction('start', c.id, c.name)}
                                    title="Chạy container"
                                    className="btn btn-glass btn-sm text-green-400"
                                    style={{ padding: '6px' }}
                                  >
                                    <Play size={12} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleAction('restart', c.id, c.name)}
                                  title="Restart container"
                                  className="btn btn-glass btn-sm text-blue-400"
                                  style={{ padding: '6px' }}
                                >
                                  <RotateCw size={12} />
                                </button>
                                <button
                                  onClick={() => viewLogs(c.id, c.name)}
                                  title="Xem Logs"
                                  className="btn btn-glass btn-sm text-indigo-300"
                                  style={{ padding: '6px' }}
                                >
                                  <FileText size={12} />
                                </button>
                                <button
                                  onClick={() => handleRemove(c.id, c.name)}
                                  title="Xóa container"
                                  className="btn btn-glass btn-sm text-red-400"
                                  style={{ padding: '6px' }}
                                >
                                  <Trash2 size={12} />
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

          {/* TAB 2: IMAGES */}
          {activeTab === 'images' && (
            <div className="card-glass overflow-hidden rounded-xl">
              {imagesLoading ? (
                <div className="text-center py-12 text-gray-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  Đang tải danh sách Docker Images cục bộ...
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-12 text-gray-400">Chưa có Docker Image nào được tải về trên VPS.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="explorer-list-table">
                    <thead>
                      <tr>
                        <th>Repository</th>
                        <th>Tag</th>
                        <th>Image ID</th>
                        <th>Ngày tải / Tạo</th>
                        <th>Dung lượng</th>
                        <th style={{ textAlign: 'center', width: '100px' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {images.map((img) => (
                        <tr key={img.id}>
                          <td className="font-semibold text-gray-200">
                            <div className="explorer-list-name-col">
                              <ImageIcon size={16} className="text-indigo-400 shrink-0" />
                              <span className="explorer-list-name">{img.repository}</span>
                            </div>
                          </td>
                          <td className="font-mono text-xs text-gray-300">{img.tag}</td>
                          <td className="font-mono text-xs text-gray-400">{img.id.substring(0, 12)}</td>
                          <td className="text-xs text-gray-400">{img.created}</td>
                          <td className="font-mono text-xs text-indigo-300">{img.size}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleRemoveImage(img.id, img.repository, img.tag)}
                                className="btn btn-glass btn-sm text-red-400"
                              >
                                <Trash2 size={12} /> Xóa
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

          {/* Clean system banner */}
          <div className="flex justify-end mt-4">
            <button
              onClick={pruneSystem}
              className="btn btn-glass text-yellow-400 text-xs"
              style={{ background: 'rgba(234, 179, 8, 0.05)', borderColor: 'rgba(234, 179, 8, 0.15)' }}
            >
              System Prune (Giải phóng ổ cứng Docker)
            </button>
          </div>
        </>
      )}

      {/* Deploy Container Modal */}
      {showDeployModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h2>Triển khai Docker Container mới</h2>
              <button onClick={() => setShowDeployModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDeploySubmit}>
              <div className="modal-body space-y-4" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
                
                {/* Image & Name */}
                <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Tên Container (Tùy chọn)</label>
                    <input 
                      type="text" 
                      placeholder="vd: my-postgres-db"
                      value={containerName} 
                      onChange={e => setContainerName(e.target.value)} 
                      className="input-glass"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tên Docker Image (Bắt buộc)</label>
                    <input 
                      type="text" 
                      placeholder="vd: postgres:alpine"
                      required
                      value={imageName} 
                      onChange={e => setImageName(e.target.value)} 
                      className="input-glass"
                    />
                  </div>
                </div>

                {/* Restart policy */}
                <div className="form-group">
                  <label>Chính sách khởi động lại (Restart Policy)</label>
                  <select 
                    value={restartPolicy} 
                    onChange={e => setRestartPolicy(e.target.value)} 
                    className="input-glass"
                  >
                    <option value="always">Always (Luôn khởi động lại)</option>
                    <option value="unless-stopped">Unless Stopped (Khởi động lại trừ khi chủ động dừng)</option>
                    <option value="on-failure">On Failure (Chỉ khởi động lại khi lỗi)</option>
                    <option value="no">No (Không khởi động lại)</option>
                  </select>
                </div>

                {/* Ports mapping list */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Cấu hình Cổng (Port Mappings)</label>
                    <button 
                      type="button" 
                      onClick={() => addRow(portsList, setPortsList, { host: '', container: '' })}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <PlusCircle size={12} /> Thêm cổng
                    </button>
                  </div>
                  <div className="space-y-2">
                    {portsList.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          placeholder="Host Port (vd: 8080)" 
                          value={p.host}
                          onChange={e => updateRow(portsList, setPortsList, idx, 'host', e.target.value)}
                          className="input-glass"
                          style={{ flex: 1, padding: '8px' }}
                        />
                        <span className="text-gray-400">:</span>
                        <input 
                          type="number" 
                          placeholder="Container Port (vd: 80)" 
                          required={portsList.length > 1 || p.host !== ''}
                          value={p.container}
                          onChange={e => updateRow(portsList, setPortsList, idx, 'container', e.target.value)}
                          className="input-glass"
                          style={{ flex: 1, padding: '8px' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => removeRow(portsList, setPortsList, idx)}
                          disabled={portsList.length === 1}
                          className="text-red-400 hover:bg-white/5 p-2 rounded disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Volumes mapping list */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Cấu hình Thư mục (Volume Mappings)</label>
                    <button 
                      type="button" 
                      onClick={() => addRow(volumesList, setVolumesList, { host: '', container: '' })}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <PlusCircle size={12} /> Thêm Volume
                    </button>
                  </div>
                  <div className="space-y-2">
                    {volumesList.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="Thư mục trên VPS (Host Path, vd: /var/pgdata)" 
                          value={v.host}
                          onChange={e => updateRow(volumesList, setVolumesList, idx, 'host', e.target.value)}
                          className="input-glass"
                          style={{ flex: 1, padding: '8px' }}
                        />
                        <span className="text-gray-400">:</span>
                        <input 
                          type="text" 
                          placeholder="Thư mục trong Container (Container Path)" 
                          required={volumesList.length > 1 || v.host !== ''}
                          value={v.container}
                          onChange={e => updateRow(volumesList, setVolumesList, idx, 'container', e.target.value)}
                          className="input-glass"
                          style={{ flex: 1, padding: '8px' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => removeRow(volumesList, setVolumesList, idx)}
                          disabled={volumesList.length === 1}
                          className="text-red-400 hover:bg-white/5 p-2 rounded disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Env variables list */}
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Biến Môi trường (Environment Variables)</label>
                    <button 
                      type="button" 
                      onClick={() => addRow(envList, setEnvList, { key: '', value: '' })}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <PlusCircle size={12} /> Thêm biến
                    </button>
                  </div>
                  <div className="space-y-2">
                    {envList.map((env, idx) => (
                      <div key={idx} className="flex gap-2 items-center" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          placeholder="KEY (vd: POSTGRES_PASSWORD)" 
                          value={env.key}
                          onChange={e => updateRow(envList, setEnvList, idx, 'key', e.target.value)}
                          className="input-glass font-mono uppercase"
                          style={{ flex: 1, padding: '8px' }}
                        />
                        <span className="text-gray-400">=</span>
                        <input 
                          type="text" 
                          placeholder="VALUE" 
                          required={envList.length > 1 || env.key !== ''}
                          value={env.value}
                          onChange={e => updateRow(envList, setEnvList, idx, 'value', e.target.value)}
                          className="input-glass"
                          style={{ flex: 1, padding: '8px' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => removeRow(envList, setEnvList, idx)}
                          disabled={envList.length === 1}
                          className="text-red-400 hover:bg-white/5 p-2 rounded disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-glass" 
                  onClick={() => setShowDeployModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={deployLoading}
                >
                  {deployLoading ? 'Đang khởi tạo...' : 'Deploy Container'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pull Image Modal */}
      {showPullModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2>Tải Docker Image mới (Pull Image)</h2>
              <button onClick={() => setShowPullModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePullImage}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label>Tên Image từ Docker Hub</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: nginx:alpine, redis:7-alpine, ubuntu:22.04"
                    value={pullImageName}
                    onChange={e => setPullImageName(e.target.value)}
                    className="input-glass"
                  />
                  <small className="text-gray-400 block mt-1.5 leading-normal">
                    Lưu ý: Tải về ảnh lớn có thể tốn vài chục giây tùy tốc độ mạng VPS của bạn.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-glass" 
                  onClick={() => setShowPullModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={pullLoading}
                >
                  {pullLoading ? 'Đang tải...' : 'Tải về (Pull)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {selectedContainerLogs && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxH: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Terminal size={18} className="text-indigo-400" />
                Logs: {selectedContainerLogs}
              </h3>
              <button onClick={() => setSelectedContainerLogs(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body flex-1 overflow-auto bg-black/60 font-mono text-xs text-green-400 p-4 rounded-lg min-h-[300px]" style={{ margin: '16px 20px' }}>
              {logsLoading ? 'Đang đọc log Docker...' : <pre className="whitespace-pre-wrap">{logsText}</pre>}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setSelectedContainerLogs(null)}
                className="btn btn-glass"
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
