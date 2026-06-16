import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Editor from '@monaco-editor/react';
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
  ShieldAlert,
  Edit,
  Code
} from 'lucide-react';

export default function Docker() {
  const { apiCall, showToast, isConnected, socket, currentVPS } = useVPS();
  const [activeTab, setActiveTab] = useState('containers'); // 'containers' | 'images' | 'compose'
  const [containers, setContainers] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [hasDocker, setHasDocker] = useState(true);

  // Docker Compose Stacks States
  const [composeProjects, setComposeProjects] = useState([]);
  const [composeLoading, setComposeLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  // Live Operation Task Overlay
  const [taskRunning, setTaskRunning] = useState(false);
  const [taskLogs, setTaskLogs] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Logs modal state
  const [selectedContainerLogs, setSelectedContainerLogs] = useState(null);
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(3000);
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

  const fetchComposeProjects = async () => {
    setComposeLoading(true);
    try {
      const res = await apiCall('/api/docker/compose/list', 'POST');
      if (res.success) {
        setComposeProjects(res.data || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Không thể tải danh sách dự án Docker Compose', 'error');
    } finally {
      setComposeLoading(false);
    }
  };

  const openEditor = async (project = null) => {
    setSelectedProject(project);
    setShowEditor(true);
    if (project) {
      setNewProjectName(project.name);
      setLoading(true);
      try {
        const res = await apiCall('/api/docker/compose/config', 'POST', {
          configPath: project.configPath
        });
        if (res.success) {
          setEditorContent(res.data || '');
        }
      } catch (err) {
        showToast('Không thể tải file cấu hình', 'error');
      } finally {
        setLoading(false);
      }
    } else {
      setNewProjectName('');
      setEditorContent(`version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: always
`);
    }
  };

  const handleSaveCompose = async () => {
    if (!newProjectName.trim()) {
      showToast('Vui lòng điền tên dự án', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await apiCall('/api/docker/compose/save', 'POST', {
        projectName: newProjectName.trim(),
        configPath: selectedProject?.configPath || null,
        configContent: editorContent
      });

      if (res.success) {
        showToast(res.message, 'success');
        setShowEditor(false);
        fetchComposeProjects();
      }
    } catch (err) {
      showToast('Lỗi lưu cấu hình: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const runComposeOperation = async (dir, cmd) => {
    setTaskLogs(`>> [${new Date().toLocaleTimeString()}] Đang chuẩn bị chạy lệnh: docker compose ${cmd}...\n`);
    setTaskRunning(true);
    setShowTaskModal(true);

    try {
      const res = await apiCall('/api/docker/compose/prepare-cmd', 'POST', {
        dir,
        cmd
      });

      if (res.success) {
        socket.emit('task:run', {
          vpsConfig: currentVPS,
          command: res.command
        });
      }
    } catch (err) {
      setTaskLogs(prev => prev + `>> THẤT BẠI: ${err.response?.data?.error || err.message}\n`);
      setTaskRunning(false);
    }
  };

  const handleDeleteCompose = async (project) => {
    if (!window.confirm(`CẢNH BÁO: Thao tác này sẽ dừng toàn bộ containers của dự án "${project.name}" và XÓA HOÀN TOÀN thư mục ${project.dir}. Bạn có chắc chắn?`)) return;
    setLoading(true);
    try {
      const res = await apiCall('/api/docker/compose/delete', 'POST', {
        dir: project.dir
      });
      if (res.success) {
        showToast(res.message, 'success');
        fetchComposeProjects();
      }
    } catch (err) {
      showToast('Lỗi khi xóa dự án: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Socket Events for task stream
  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data) => {
      setTaskLogs(prev => prev + data);
    };

    const handleEnded = ({ code, error }) => {
      setTaskRunning(false);
      if (code === 0) {
        setTaskLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] THỰC THI THÀNH CÔNG.\n`);
        showToast('Thực thi kịch bản Compose thành công!', 'success');
        fetchComposeProjects();
      } else {
        const errMsg = error || `Mã lỗi trả về: ${code}`;
        setTaskLogs(prev => prev + `\n>> [${new Date().toLocaleTimeString()}] THẤT BẠI: ${errMsg}\n`);
        showToast('Thực thi Compose thất bại: ' + errMsg, 'error');
      }
    };

    socket.on('task:output', handleOutput);
    socket.on('task:ended', handleEnded);

    return () => {
      socket.off('task:output', handleOutput);
      socket.off('task:ended', handleEnded);
    };
  }, [socket]);

  useEffect(() => {
    if (isConnected) {
      fetchData();
    }
  }, [isConnected, activeTab]);

  const fetchData = () => {
    if (activeTab === 'containers') {
      fetchContainers();
    } else if (activeTab === 'images') {
      fetchImages();
    } else if (activeTab === 'compose') {
      fetchComposeProjects();
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
    setSelectedContainerId(id);
    setSelectedContainerLogs(name);
    setLogsLoading(true);
    setLogsText('');
    try {
      const res = await apiCall('/api/docker/logs', 'POST', { id });
      setLogsText(res.data?.logs || 'Không có log.');
    } catch (err) {
      console.error(err);
      setSelectedContainerLogs(null);
      setSelectedContainerId(null);
    } finally {
      setLogsLoading(false);
    }
  };

  const closeLogsModal = () => {
    setSelectedContainerLogs(null);
    setSelectedContainerId(null);
    setAutoRefreshLogs(false);
  };

  useEffect(() => {
    if (!selectedContainerId || !autoRefreshLogs) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiCall('/api/docker/logs', 'POST', { id: selectedContainerId });
        setLogsText(res.data?.logs || 'Không có log.');
      } catch (err) {
        console.error('Lỗi khi tự động cập nhật logs:', err);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [selectedContainerId, autoRefreshLogs, refreshInterval]);

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
              {activeTab === 'compose' ? (
                <button
                  onClick={() => openEditor(null)}
                  className="btn btn-primary"
                >
                  <Plus size={14} /> Tạo Dự Án Compose
                </button>
              ) : (
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
            </>
          )}
          <button
            onClick={fetchData}
            disabled={loading || imagesLoading || composeLoading}
            className="btn btn-glass"
          >
            <RefreshCw size={14} className={(loading || imagesLoading || composeLoading) ? 'animate-spin' : ''} />
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
        <button 
          className={`db-tab-item ${activeTab === 'compose' ? 'active' : ''}`}
          onClick={() => setActiveTab('compose')}
        >
          <Layers size={16} className="text-purple-400" />
          Docker Compose ({composeProjects.length})
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

          {/* TAB 3: DOCKER COMPOSE STACKS */}
          {activeTab === 'compose' && (
            <div className="card-glass overflow-hidden rounded-xl">
              {composeLoading ? (
                <div className="text-center py-12 text-gray-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                  Đang tải danh sách các dự án Docker Compose...
                </div>
              ) : composeProjects.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  Chưa có dự án Docker Compose nào. Hãy nhấn nút "Tạo Dự Án Compose" để bắt đầu!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="explorer-list-table">
                    <thead>
                      <tr>
                        <th>Tên dự án</th>
                        <th>Đường dẫn thư mục</th>
                        <th>File cấu hình</th>
                        <th>Containers liên kết</th>
                        <th style={{ textAlign: 'center', width: '320px' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {composeProjects.map((p) => (
                        <tr key={p.configPath}>
                          <td>
                            <div className="explorer-list-name-col">
                              <Layers size={16} className="text-purple-400 shrink-0" />
                              <span className="font-semibold text-gray-200">{p.name}</span>
                            </div>
                          </td>
                          <td className="font-mono text-xs text-gray-400 max-w-[200px] truncate" title={p.dir}>
                            {p.dir}
                          </td>
                          <td className="font-mono text-xs text-gray-400">
                            docker-compose.yml
                          </td>
                          <td className="font-mono text-xs text-gray-400 max-w-[200px] truncate" title={p.status}>
                            {p.status}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => runComposeOperation(p.dir, 'up')}
                                className="btn btn-glass btn-sm text-green-400"
                                title="Khởi chạy Stack (up -d)"
                                style={{ padding: '6px 8px' }}
                              >
                                <Play size={12} className="inline mr-1" /> Up
                              </button>
                              <button
                                onClick={() => runComposeOperation(p.dir, 'down')}
                                className="btn btn-glass btn-sm text-yellow-400"
                                title="Dừng và xóa Stack (down)"
                                style={{ padding: '6px 8px' }}
                              >
                                <Square size={12} className="inline mr-1" /> Down
                              </button>
                              <button
                                onClick={() => runComposeOperation(p.dir, 'restart')}
                                className="btn btn-glass btn-sm text-blue-400"
                                title="Khởi động lại Stack (restart)"
                                style={{ padding: '6px 8px' }}
                              >
                                <RotateCw size={12} className="inline mr-1" /> Restart
                              </button>
                              <button
                                onClick={() => runComposeOperation(p.dir, 'logs')}
                                className="btn btn-glass btn-sm text-indigo-300"
                                title="Xem live logs"
                                style={{ padding: '6px 8px' }}
                              >
                                <Terminal size={12} className="inline mr-1" /> Logs
                              </button>
                              <button
                                onClick={() => openEditor(p)}
                                className="btn btn-glass btn-sm text-gray-300"
                                title="Sửa file docker-compose.yml"
                                style={{ padding: '6px 8px' }}
                              >
                                <Edit size={12} className="inline mr-1" /> Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteCompose(p)}
                                className="btn btn-glass btn-sm text-red-400"
                                title="Xóa toàn bộ dự án"
                                style={{ padding: '6px' }}
                              >
                                <Trash2 size={12} />
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
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} className="text-indigo-400" />
                <h3 className="font-semibold text-lg">
                  Logs: {selectedContainerLogs}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium" style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: '#9ca3af' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setLogsLoading(true);
                    try {
                      const res = await apiCall('/api/docker/logs', 'POST', { id: selectedContainerId });
                      setLogsText(res.data?.logs || 'Không có log.');
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setLogsLoading(false);
                    }
                  }}
                  disabled={logsLoading}
                  className="btn btn-glass btn-xs"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                >
                  Làm mới
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefreshLogs}
                    onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                    className="rounded"
                    style={{ cursor: 'pointer' }}
                  />
                  Tự động làm mới
                </label>
                {autoRefreshLogs && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                    className="bg-black/30 border border-white/10 rounded px-1 py-0.5 text-xs text-gray-300"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value={3000}>3 giây</option>
                    <option value={5000}>5 giây</option>
                    <option value={10000}>10 giây</option>
                  </select>
                )}
              </div>
              <button onClick={closeLogsModal} className="modal-close-btn" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body flex-1 overflow-auto bg-black/60 font-mono text-xs text-green-400 p-4 rounded-lg min-h-[350px]" style={{ margin: '16px 20px', userSelect: 'text' }}>
              {logsLoading ? 'Đang đọc log Docker...' : <pre className="whitespace-pre-wrap">{logsText}</pre>}
            </div>
            <div className="modal-footer">
              <button
                onClick={closeLogsModal}
                className="btn btn-glass"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monaco Compose Editor Modal */}
      {showEditor && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxWidth: '95%', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 className="flex items-center gap-2">
                <Code size={18} className="text-purple-400" />
                {selectedProject ? `Cấu hình Compose: ${newProjectName}` : 'Tạo Dự Án Docker Compose mới'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4 flex-1">
              {!selectedProject && (
                <div className="form-group">
                  <label className="text-xs text-gray-400 block mb-1">Tên dự án (Không viết dấu, không khoảng trắng):</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: my-ghost-blog, sample-redis-stack"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    className="input-glass"
                  />
                  <small className="text-[10px] text-gray-500 block leading-tight mt-1">Dự án sẽ được lưu tại thư mục <code>/var/www/docker-apps/{newProjectName || 'project-name'}</code></small>
                </div>
              )}
              <div className="form-group flex-1">
                <label className="text-xs text-gray-400 block mb-2">Định nghĩa YAML (docker-compose.yml):</label>
                <div className="border border-white/10 rounded-lg overflow-hidden" style={{ minHeight: '350px' }}>
                  <Editor
                    height="350px"
                    defaultLanguage="yaml"
                    theme="vs-dark"
                    value={editorContent}
                    onChange={(val) => setEditorContent(val)}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      wordWrap: 'on'
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-glass" 
                onClick={() => setShowEditor(false)}
              >
                Hủy
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveCompose}
                disabled={loading}
              >
                {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Compose Task Log Modal */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '800px', maxH: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Terminal size={18} className="text-purple-400" />
                Tiến trình thực thi Docker Compose
              </h3>
              <button onClick={() => { if (!taskRunning) setShowTaskModal(false); }} className="modal-close-btn" disabled={taskRunning}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body flex-1 overflow-auto bg-black/60 font-mono text-xs text-green-400 p-4 rounded-lg min-h-[350px]" style={{ margin: '16px 20px' }}>
              <pre className="whitespace-pre-wrap">{taskLogs}</pre>
            </div>
            <div className="modal-footer flex gap-2">
              {taskRunning && socket && (
                <button
                  onClick={() => {
                    socket.emit('task:stop');
                    setTaskRunning(false);
                    setTaskLogs(prev => prev + '\n>> [HỦY] Tiến trình bị dừng bởi người dùng.\n');
                  }}
                  className="btn btn-danger text-xs font-semibold py-2 px-4 rounded-lg"
                >
                  Dừng tiến trình (Kill)
                </button>
              )}
              <button
                onClick={() => setShowTaskModal(false)}
                disabled={taskRunning}
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
