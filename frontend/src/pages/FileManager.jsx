import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import Editor from '@monaco-editor/react';
import { 
  Folder, 
  File, 
  ArrowLeft, 
  Trash2, 
  Edit3, 
  Plus, 
  Upload, 
  Download, 
  RefreshCw, 
  ChevronRight, 
  FileCode, 
  Check, 
  LayoutGrid, 
  List, 
  Search, 
  Copy, 
  Key, 
  HardDrive, 
  FolderHeart,
  Archive,
  User
} from 'lucide-react';

const getEditorLanguage = (fileName) => {
  if (!fileName) return 'plaintext';
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'php':
      return 'php';
    case 'py':
      return 'python';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'md':
      return 'markdown';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sql':
      return 'sql';
    case 'conf':
    case 'ini':
    case 'htaccess':
      return 'ini';
    default:
      return 'plaintext';
  }
};

export default function FileManager() {
  const { apiCall, showToast, currentVPS } = useVPS();
  const [currentPath, setCurrentPath] = useState('/var/www');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'list' or 'grid'

  // New Folder / File Name Dialogs
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState('');

  // Editing file modal
  const [editingFile, setEditingFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  // Uploading state
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Search and selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [scanningFolderSize, setScanningFolderSize] = useState(false);

  // System Shortcuts
  const SHORTCUTS = [
    { name: 'Web Root', path: '/var/www', icon: FolderHeart },
    { name: 'Root Home', path: '/root', icon: Folder },
    { name: 'Nginx Config', path: '/etc/nginx', icon: Folder },
    { name: 'System Config', path: '/etc', icon: Folder },
    { name: 'Temporary', path: '/tmp', icon: Folder },
    { name: 'Home Users', path: '/home', icon: Folder }
  ];

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath]);

  const fetchFiles = async (path) => {
    setLoading(true);
    setSelectedItem(null);
    setPreviewContent('');
    try {
      const res = await apiCall('/api/files/list', 'POST', { path });
      // Sort files: folders first, then files alphabetically
      const sorted = (res.data?.files || []).sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sorted);
      setCurrentPath(res.data?.path || path);
    } catch (err) {
      console.error(err);
      if (path !== '/') {
        const parts = path.split('/');
        parts.pop();
        const parent = parts.join('/') || '/';
        setCurrentPath(parent);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (file) => {
    setSelectedItem(file);
    setPreviewContent('');
    
    if (file.type === 'file') {
      const ext = file.name.split('.').pop().toLowerCase();
      const textExtensions = ['txt', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'sh', 'conf', 'ini', 'php', 'py', 'md', 'xml', 'yml', 'yaml', 'env', 'htaccess'];
      if (textExtensions.includes(ext)) {
        setPreviewLoading(true);
        try {
          const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
          const res = await apiCall('/api/files/read', 'POST', { path: fullPath });
          const content = res.data?.content || '';
          setPreviewContent(content.substring(0, 600) + (content.length > 600 ? '\n... (bị cắt ngắn)' : ''));
        } catch (err) {
          console.error('Không thể đọc preview:', err);
          setPreviewContent('Lỗi: Không thể đọc nội dung tệp tin.');
        } finally {
          setPreviewLoading(false);
        }
      } else {
        setPreviewContent('Không có bản xem trước cho định dạng này.');
      }
    }
  };

  const handleNavigate = (type, name) => {
    if (type === 'directory') {
      const nextPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      setCurrentPath(nextPath);
    } else {
      handleOpenFile(name);
    }
  };

  const handleGoBack = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/');
    parts.pop();
    const parent = parts.join('/') || '/';
    setCurrentPath(parent);
  };

  const handleOpenFile = async (name) => {
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;

    // Check file size to avoid browser crash
    const fileObj = files.find(f => f.name === name);
    if (fileObj && fileObj.size) {
      const sizeStr = fileObj.size.toUpperCase();
      let isLarge = false;
      if (sizeStr.includes('MB')) {
        const num = parseFloat(sizeStr);
        if (!isNaN(num) && num > 5) {
          isLarge = true;
        }
      } else if (sizeStr.includes('GB')) {
        isLarge = true;
      }

      if (isLarge) {
        if (!window.confirm(`CẢNH BÁO: Tệp tin này có dung lượng lớn (${fileObj.size}). Việc mở tệp tin lớn trong trình duyệt có thể gây đơ hoặc treo trình duyệt. Bạn có chắc chắn muốn tiếp tục mở không?`)) {
          return;
        }
      }
    }

    setEditingFile({ name, path: fullPath });
    setLoading(true);
    try {
      const res = await apiCall('/api/files/read', 'POST', { path: fullPath });
      setFileContent(res.data?.content || '');
    } catch (err) {
      console.error(err);
      setEditingFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      await apiCall('/api/files/write', 'POST', {
        path: editingFile.path,
        content: fileContent
      });
      showToast('Đã lưu file thành công!', 'success');
      setEditingFile(null);
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFile(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const path = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    try {
      await apiCall('/api/files/mkdir', 'POST', { path });
      showToast(`Đã tạo thư mục ${newFolderName}`, 'success');
      setNewFolderName('');
      setShowNewFolder(false);
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFile = async (e) => {
    e.preventDefault();
    if (!newFileNameInput.trim()) return;
    const path = currentPath === '/' ? `/${newFileNameInput}` : `${currentPath}/${newFileNameInput}`;
    try {
      await apiCall('/api/files/write', 'POST', { path, content: '' });
      showToast(`Đã tạo file ${newFileNameInput}`, 'success');
      setNewFileNameInput('');
      setShowNewFile(false);
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${name}"? Hành động này sẽ xóa vĩnh viễn và không thể khôi phục!`)) return;
    try {
      await apiCall('/api/files/delete', 'POST', { path: fullPath });
      showToast(`Đã xóa ${name}`, 'success');
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const oldPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const newName = window.prompt(`Nhập tên mới cho "${name}":`, name);
    if (!newName || newName === name) return;
    const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;

    apiCall('/api/files/rename', 'POST', { oldPath, newPath })
      .then(() => {
        showToast(`Đã đổi tên thành công`, 'success');
        fetchFiles(currentPath);
      })
      .catch(console.error);
  };

  const handleChmod = async (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const newPerm = window.prompt(`Đổi quyền (Chmod) cho "${name}" (Ví dụ: 755, 644):`, '755');
    if (!newPerm) return;

    let recursive = false;
    if (fileObj.type === 'directory') {
      recursive = window.confirm(`Bạn có muốn áp dụng quyền này đệ quy (Chmod -R) cho tất cả thư mục và tệp tin con bên trong không?`);
    }

    try {
      await apiCall('/api/files/chmod', 'POST', { path: fullPath, permissions: newPerm, recursive });
      showToast(`Đã thay đổi quyền thành công`, 'success');
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGetFolderSize = async () => {
    if (!selectedItem || selectedItem.type !== 'directory') return;
    const folderPath = currentPath === '/' ? `/${selectedItem.name}` : `${currentPath}/${selectedItem.name}`;
    setScanningFolderSize(true);
    showToast(`Đang tính toán dung lượng thư mục ${selectedItem.name}...`, 'info');
    try {
      const res = await apiCall('/api/files/folder-size', 'POST', { path: folderPath });
      if (res.success) {
        const actualSize = res.data;
        setSelectedItem(prev => prev ? { ...prev, size: actualSize } : null);
        setFiles(prev => prev.map(f => f.name === selectedItem.name ? { ...f, size: actualSize } : f));
        showToast(`Dung lượng thực tế: ${actualSize}`, 'success');
      }
    } catch (err) {
      showToast('Không thể quét dung lượng: ' + err.message, 'error');
    } finally {
      setScanningFolderSize(false);
    }
  };

  const handleChown = async (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const newOwner = window.prompt(`Đổi chủ sở hữu (Chown) cho "${name}" (Ví dụ: www-data, www-data:www-data, root):`, fileObj.owner || 'www-data');
    if (!newOwner) return;

    const parts = newOwner.split(':');
    const owner = parts[0].trim();
    const group = parts[1] ? parts[1].trim() : '';

    try {
      await apiCall('/api/files/chown', 'POST', { path: fullPath, owner, group });
      showToast(`Đã thay đổi chủ sở hữu thành công`, 'success');
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = async (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const oldPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const newPath = window.prompt(`Sao chép "${name}" đến đường dẫn mới (đường dẫn tuyệt đối):`, oldPath + '_copy');
    if (!newPath) return;

    try {
      await apiCall('/api/files/copy', 'POST', { oldPath, newPath });
      showToast(`Đã sao chép thành công`, 'success');
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;
    await uploadMultipleFiles(filesList);
  };

  const uploadMultipleFiles = async (filesList) => {
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('remotePath', currentPath);
      formData.append('vpsConfig', JSON.stringify(currentVPS));

      showToast(`Đang tải lên (${i + 1}/${filesList.length}): ${file.name}...`, 'info');

      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        });
        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          showToast(`Lỗi khi tải lên ${file.name}: ${result.error}`, 'error');
        }
      } catch (err) {
        failCount++;
        showToast(`Lỗi kết nối tải lên ${file.name}: ${err.message}`, 'error');
      }
    }

    if (successCount > 0) {
      showToast(`Đã tải lên thành công ${successCount} tệp!`, 'success');
    }
    if (failCount > 0) {
      showToast(`Có ${failCount} tệp tải lên thất bại.`, 'warning');
    }

    setUploading(false);
    fetchFiles(currentPath);
  };

  const handleDownload = (e, name) => {
    if (e) e.stopPropagation();
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    showToast(`Đang chuẩn bị tải xuống: ${name}`, 'info');

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/files/download';
    form.style.display = 'none';

    const inputPath = document.createElement('input');
    inputPath.name = 'path';
    inputPath.value = fullPath;
    form.appendChild(inputPath);

    const inputVPS = document.createElement('input');
    inputVPS.name = 'vpsConfig';
    inputVPS.value = JSON.stringify(currentVPS);
    form.appendChild(inputVPS);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const handleZip = async (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const sourcePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const defaultZipName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) + '.zip' : name + '.zip';
    const zipName = window.prompt(`Nhập tên tệp nén (đuôi .zip hoặc .tar.gz):`, defaultZipName);
    if (!zipName) return;

    const zipPath = currentPath === '/' ? `/${zipName}` : `${currentPath}/${zipName}`;

    showToast(`Đang thực hiện nén ${name}...`, 'info');
    try {
      await apiCall('/api/files/zip', 'POST', { sourcePath, zipPath });
      showToast(`Đã nén thành công thành ${zipName}`, 'success');
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnzip = async (e, fileObj) => {
    if (e) e.stopPropagation();
    const name = fileObj.name;
    const zipPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const destPath = window.prompt(`Nhập đường dẫn giải nén tuyệt đối:`, currentPath);
    if (!destPath) return;

    showToast(`Đang thực hiện giải nén ${name}...`, 'info');
    try {
      await apiCall('/api/files/unzip', 'POST', { zipPath, destPath });
      showToast(`Đã giải nén thành công tệp ${name}`, 'success');
      fetchFiles(currentPath);
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and drop events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadMultipleFiles(e.dataTransfer.files);
    }
  };

  const getBreadcrumbs = () => {
    const paths = currentPath.split('/').filter(p => p);
    return (
      <>
        <button onClick={() => setCurrentPath('/')} className="hover:text-white font-semibold">root</button>
        {paths.map((p, idx) => {
          const pathTillNow = '/' + paths.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={idx}>
              <ChevronRight size={14} className="text-gray-600 shrink-0" />
              <button onClick={() => setCurrentPath(pathTillNow)} className="hover:text-white max-w-[120px] truncate">{p}</button>
            </React.Fragment>
          );
        })}
      </>
    );
  };

  // Subfolders list in left panel
  const subfolders = files.filter(f => f.type === 'directory');

  // Filtered files based on live search
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Folder stats
  const totalFoldersCount = subfolders.length;
  const totalFilesCount = files.length - totalFoldersCount;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Quản lý tệp tin</h1>
          <p className="text-sm text-gray-400 font-medium">Giao diện explorer 3 cột chuyên nghiệp & hiện đại</p>
        </div>
        <div className="explorer-toolbar">
          {/* View switcher */}
          <div className="explorer-view-switcher">
            <button
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'active' : ''}
              title="Xem dạng ô lớn"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'active' : ''}
              title="Xem danh sách chi tiết"
            >
              <List size={16} />
            </button>
          </div>

          <label className="btn btn-glass text-indigo-300 cursor-pointer flex items-center gap-1.5 py-2">
            <Upload size={14} />
            Tải lên
            <input type="file" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          <button onClick={() => setShowNewFolder(true)} className="btn btn-glass flex items-center gap-1.5 py-2">
            <Plus size={14} /> Thư mục mới
          </button>
          <button onClick={() => setShowNewFile(true)} className="btn btn-glass flex items-center gap-1.5 py-2">
            <Plus size={14} /> File mới
          </button>
          <button onClick={() => fetchFiles(currentPath)} disabled={loading} className="btn btn-glass flex items-center justify-center p-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Explorer Address Bar & Search */}
      <div className="explorer-address-bar-container">
        {/* Address bar */}
        <div className="explorer-address-bar">
          {currentPath !== '/' && (
            <button
              onClick={handleGoBack}
              className="explorer-address-back-btn"
              title="Trở lại"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="explorer-breadcrumbs">
            {getBreadcrumbs()}
          </div>
          <span className="explorer-current-path-badge">{currentPath}</span>
        </div>

        {/* Live Search box */}
        <div className="explorer-search-wrapper">
          <input 
            type="text"
            placeholder="Tìm kiếm tệp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="explorer-search-input"
          />
          <Search size={16} className="explorer-search-icon" />
        </div>
      </div>

      {/* File Editor (Full Screen Mode Overlay inside main card) */}
      {editingFile && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <FileCode className="text-indigo-400" size={18} />
              <span className="font-semibold text-sm">{editingFile.name}</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono uppercase">
                {getEditorLanguage(editingFile.name)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveFile}
                disabled={savingFile}
                className="btn btn-glass text-green-400 flex items-center gap-1.5"
              >
                <Check size={14} /> Lưu file
              </button>
              <button onClick={() => setEditingFile(null)} className="btn btn-glass text-gray-400">Hủy</button>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden border border-white/10" style={{ height: '500px' }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={getEditorLanguage(editingFile.name)}
              value={fileContent}
              onChange={(value) => setFileContent(value || '')}
              options={{
                minimap: { enabled: true },
                fontSize: 13,
                automaticLayout: true,
                wordWrap: 'on',
                cursorBlinking: 'smooth',
                scrollbar: {
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10
                }
              }}
            />
          </div>
        </div>
      )}

      {/* 3-COLUMN EXPLORER LAYOUT */}
      {!editingFile && (
        <div className="file-explorer-container">
          
          {/* COLUMN 1: LEFT SIDEBAR (Shortcuts & Folder Tree) */}
          <div className="file-explorer-left">
            {/* System Shortcuts */}
            <div>
              <h3 className="explorer-section-title">Lối tắt hệ thống</h3>
              <div className="space-y-1">
                {SHORTCUTS.map((shortcut) => {
                  const IconComp = shortcut.icon;
                  const isActive = currentPath === shortcut.path;
                  return (
                    <div
                      key={shortcut.name}
                      onClick={() => setCurrentPath(shortcut.path)}
                      className={`explorer-shortcut-item ${isActive ? 'active' : ''}`}
                    >
                      <IconComp size={16} className={isActive ? 'text-indigo-400' : 'text-gray-400'} />
                      <span className="font-medium">{shortcut.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Folder list tree (current directories) */}
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="explorer-section-title">Thư mục con</h3>
              <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-none">
                {subfolders.length === 0 ? (
                  <p className="text-xs text-gray-500 italic px-2">Không có thư mục con</p>
                ) : (
                  subfolders.map((folder) => (
                    <div
                      key={folder.name}
                      onClick={() => handleNavigate('directory', folder.name)}
                      className="explorer-tree-item"
                    >
                      <Folder size={14} className="text-yellow-400 shrink-0" />
                      <span className="truncate w-full" title={folder.name}>{folder.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* COLUMN 2: MIDDLE EXPLORER (Vùng chứa file chính) */}
          <div 
            className={`file-explorer-middle ${dragActive ? 'drag-over-active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            {dragActive && (
              <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-sm pointer-events-none flex items-center justify-center rounded-xl z-20 border-2 border-dashed border-indigo-400">
                <div className="text-center">
                  <Upload size={48} className="mx-auto text-indigo-400 animate-bounce mb-2" />
                  <p className="text-indigo-200 font-semibold">Thả tệp vào đây để tải lên</p>
                </div>
              </div>
            )}

            <div className="file-explorer-scroller">
              {loading ? (
                <div className="text-center py-20 text-gray-400">Đang tải danh sách file...</div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-20 text-gray-500 italic">Thư mục trống hoặc không khớp tìm kiếm.</div>
              ) : viewMode === 'grid' ? (
                
                /* GRID VIEW MODE */
                <div className="explorer-grid">
                  {filteredFiles.map((file) => {
                    const isDir = file.type === 'directory';
                    const isSelected = selectedItem?.name === file.name;
                    return (
                      <div
                        key={file.name}
                        onClick={() => handleSelectItem(file)}
                        onDoubleClick={() => handleNavigate(file.type, file.name)}
                        className={`explorer-grid-item ${isSelected ? 'selected' : ''}`}
                      >
                        {file.type === 'file' && (
                          <button
                            onClick={(e) => handleDownload(e, file.name)}
                            className="explorer-grid-item-download"
                            title="Tải xuống"
                          >
                            <Download size={12} />
                          </button>
                        )}

                        <div className="explorer-grid-item-icon">
                          {isDir ? (
                            <Folder size={40} className="text-yellow-400 filter drop-shadow-md" />
                          ) : (
                            <File size={40} className="text-indigo-300 filter drop-shadow-md" />
                          )}
                        </div>

                        <span className="explorer-grid-item-name" title={file.name}>
                          {file.name}
                        </span>
                        <span className="explorer-grid-item-size">{file.size}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                
                /* LIST VIEW MODE */
                <div className="overflow-x-auto">
                  <table className="explorer-list-table">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>Quyền</th>
                        <th style={{ textAlign: 'right' }}>Dung lượng</th>
                        <th style={{ textAlign: 'right' }}>Ngày sửa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map((file) => {
                        const isDir = file.type === 'directory';
                        const isSelected = selectedItem?.name === file.name;
                        return (
                          <tr 
                            key={file.name} 
                            onClick={() => handleSelectItem(file)}
                            onDoubleClick={() => handleNavigate(file.type, file.name)}
                            className={isSelected ? 'selected' : ''}
                          >
                            <td>
                              <div className="explorer-list-name-col">
                                {isDir ? (
                                  <Folder size={16} className="text-yellow-400 shrink-0" />
                                ) : (
                                  <File size={16} className="text-indigo-300 shrink-0" />
                                )}
                                <span className="explorer-list-name" title={file.name}>{file.name}</span>
                              </div>
                            </td>
                            <td className="font-mono text-xs text-gray-400">{file.permissions}</td>
                            <td style={{ textAlign: 'right' }} className="font-mono text-xs text-gray-300">{file.size}</td>
                            <td style={{ textAlign: 'right' }} className="font-mono text-xs text-gray-400">{file.modified}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Status indicators */}
            <div className="border-t border-white/5 pt-2 mt-2 flex items-center justify-between text-[11px] text-gray-400 font-mono">
              <div className="flex gap-4">
                <span>{totalFoldersCount} Thư mục</span>
                <span>{totalFilesCount} Tệp tin</span>
              </div>
              <span>Dung lượng thư mục hiển thị trên máy</span>
            </div>
          </div>

          {/* COLUMN 3: RIGHT DETAIL PANEL (Thông tin & Preview) */}
          <div className="file-explorer-right">
            {!selectedItem ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-4" style={{ height: '100%' }}>
                <HardDrive size={36} className="text-gray-600 mb-2.5 animate-pulse" />
                <p className="text-xs">Chọn một tệp hoặc thư mục để xem thuộc tính chi tiết & bản xem trước nội dung.</p>
              </div>
            ) : (
              <div className="preview-container">
                {/* Meta details header */}
                <div className="text-center pb-3 border-b border-white/5 space-y-2">
                  <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-xl bg-white/5">
                    {selectedItem.type === 'directory' ? (
                      <Folder size={28} className="text-yellow-400" />
                    ) : (
                      <File size={28} className="text-indigo-300" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-200 break-all px-1" title={selectedItem.name}>{selectedItem.name}</h4>
                    <p className="text-[10px] text-gray-500 font-mono">{selectedItem.type === 'directory' ? 'Thư mục' : 'Tệp tin'}</p>
                  </div>
                </div>

                {/* Properties list */}
                <div className="space-y-2 text-xs bg-black/20 p-2.5 rounded-lg border border-white/5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Dung lượng:</span>
                    <span className="font-mono text-gray-300 font-medium flex items-center gap-1">
                      {selectedItem.size}
                      {selectedItem.type === 'directory' && (
                        <button
                          onClick={handleGetFolderSize}
                          disabled={scanningFolderSize}
                          className="text-indigo-400 hover:text-indigo-300 ml-1 font-sans text-[10px] underline"
                        >
                          {scanningFolderSize ? 'Đang quét...' : 'Quét'}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-500">Quyền hạn:</span><span className="font-mono text-gray-300 font-medium">{selectedItem.permissions}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Người sở hữu:</span><span className="font-mono text-gray-300 font-medium">{selectedItem.owner || 'root'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sửa đổi:</span><span className="font-mono text-gray-300 font-medium">{selectedItem.modified}</span></div>
                </div>

                {/* Previews (if any) */}
                <div className="flex-1 min-h-0 flex flex-col">
                  <h3 className="explorer-section-title">Xem trước nội dung</h3>
                  {previewLoading ? (
                    <div className="text-center py-6 text-xs text-gray-400">Đang tải bản xem trước...</div>
                  ) : previewContent ? (
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <pre className="preview-box flex-1 scrollbar-none">{previewContent}</pre>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-500 italic">Không khả dụng cho thư mục hoặc nhị phân</div>
                  )}
                </div>

                {/* Operation actions */}
                <div className="explorer-actions-grid pt-2 border-t border-white/5 shrink-0">
                  {selectedItem.type === 'file' ? (
                    <button
                      onClick={() => handleOpenFile(selectedItem.name)}
                      className="btn btn-primary btn-sm flex items-center justify-center gap-1.5"
                    >
                      <Edit3 size={12} /> Xem/Sửa
                    </button>
                  ) : (
                    <button
                      onClick={() => handleNavigate('directory', selectedItem.name)}
                      className="btn btn-primary btn-sm flex items-center justify-center gap-1.5"
                    >
                      <Folder size={12} /> Mở folder
                    </button>
                  )}
                  
                  {selectedItem.type === 'file' && (
                    <button
                      onClick={() => handleDownload(null, selectedItem.name)}
                      className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-green-400"
                    >
                      <Download size={12} /> Tải về
                    </button>
                  )}

                  <button
                    onClick={(e) => handleChmod(e, selectedItem)}
                    className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-yellow-400"
                  >
                    <Key size={12} /> Chmod
                  </button>

                  <button
                    onClick={(e) => handleChown(e, selectedItem)}
                    className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-orange-400"
                  >
                    <User size={12} /> Chown
                  </button>

                  <button
                    onClick={(e) => handleCopy(e, selectedItem)}
                    className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-blue-400"
                  >
                    <Copy size={12} /> Sao chép
                  </button>

                  <button
                    onClick={(e) => handleRename(e, selectedItem)}
                    className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-purple-400"
                  >
                    <Edit3 size={12} /> Đổi tên
                  </button>

                  <button
                    onClick={(e) => handleZip(e, selectedItem)}
                    className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-orange-400"
                  >
                    <Archive size={12} /> Nén
                  </button>

                  {selectedItem.type === 'file' && (selectedItem.name.toLowerCase().endsWith('.zip') || selectedItem.name.toLowerCase().endsWith('.tar.gz')) && (
                    <button
                      onClick={(e) => handleUnzip(e, selectedItem)}
                      className="btn btn-glass btn-sm flex items-center justify-center gap-1.5 text-cyan-400"
                    >
                      <Folder size={12} /> Giải nén
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(e, selectedItem)}
                    className="btn btn-danger btn-sm flex items-center justify-center gap-1.5 border-none"
                  >
                    <Trash2 size={12} /> Xóa
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="modal-overlay animate-fadeIn">
          <div className="card-glass w-full max-w-sm p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="font-semibold text-lg">Tạo thư mục mới</h3>
            <form onSubmit={handleCreateFolder} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Tên thư mục"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="input-glass w-full px-3 py-2 rounded-lg text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="submit" className="btn btn-primary btn-sm px-4">Tạo</button>
                <button type="button" onClick={() => setShowNewFolder(false)} className="btn btn-glass btn-sm px-4">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFile && (
        <div className="modal-overlay animate-fadeIn">
          <div className="card-glass w-full max-w-sm p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="font-semibold text-lg">Tạo tệp tin mới</h3>
            <form onSubmit={handleCreateFile} className="space-y-3">
              <input
                type="text"
                required
                placeholder="VD: config.json"
                value={newFileNameInput}
                onChange={(e) => setNewFileNameInput(e.target.value)}
                className="input-glass w-full px-3 py-2 rounded-lg text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="submit" className="btn btn-primary btn-sm px-4">Tạo</button>
                <button type="button" onClick={() => setShowNewFile(false)} className="btn btn-glass btn-sm px-4">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
