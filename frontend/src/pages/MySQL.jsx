import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { Database, User, Trash2, Plus, Download, Upload, ShieldAlert, Table, RefreshCw, Key, Lock, Shield, ChevronDown, ChevronUp, Eye, EyeOff, CheckSquare, XSquare } from 'lucide-react';

const PRIVILEGE_OPTIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'INDEX', 'ALTER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'EXECUTE', 'CREATE VIEW', 'SHOW VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 'EVENT', 'TRIGGER'];

export default function MySQL() {
  const { apiCall, showToast, currentVPS } = useVPS();
  const [databases, setDatabases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('databases');

  // Modal / Inputs state
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPass, setDbPass] = useState('');

  // Selected Database details
  const [selectedDb, setSelectedDb] = useState(null);
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Import file path
  const [importPath, setImportPath] = useState('');
  const [importingFile, setImportingFile] = useState(false);

  // ─── Phase 5: Privilege Manager State ───
  const [grantModal, setGrantModal] = useState(null); // { user, host }
  const [grantDb, setGrantDb] = useState('*');
  const [grantPrivs, setGrantPrivs] = useState(['ALL PRIVILEGES']);
  const [grantAllPrivs, setGrantAllPrivs] = useState(true);
  const [grantLoading, setGrantLoading] = useState(false);
  const [userGrants, setUserGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);

  // Change Password Modal
  const [pwModal, setPwModal] = useState(null); // { user, host }
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    fetchMySQLData();
  }, []);

  const fetchMySQLData = async () => {
    setLoading(true);
    try {
      const dbRes = await apiCall('/api/mysql/databases', 'POST');
      const userRes = await apiCall('/api/mysql/users', 'POST');
      setDatabases(dbRes.data || []);
      setUsers(userRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDB = async (e) => {
    e.preventDefault();
    if (!dbName.trim()) return;
    try {
      await apiCall('/api/mysql/databases/add', 'POST', { name: dbName });
      showToast(`Đã tạo cơ sở dữ liệu ${dbName}`, 'success');
      setDbName('');
      fetchMySQLData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!dbUser.trim() || !dbPass.trim()) {
      showToast('Vui lòng điền đầy đủ tài khoản và mật khẩu', 'warning');
      return;
    }
    try {
      await apiCall('/api/mysql/users/add', 'POST', { user: dbUser, pass: dbPass });
      showToast(`Đã tạo người dùng ${dbUser}`, 'success');
      setDbUser('');
      setDbPass('');
      fetchMySQLData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDB = async (name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa database "${name}"? Thao tác này KHÔNG THỂ hoàn tác!`)) return;
    try {
      await apiCall('/api/mysql/databases/delete', 'POST', { name });
      showToast(`Đã xóa database ${name}`, 'success');
      if (selectedDb === name) { setSelectedDb(null); setTables([]); }
      fetchMySQLData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = async (user, host) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa user "${user}"@"${host}"?`)) return;
    try {
      await apiCall('/api/mysql/users/delete', 'POST', { user, host });
      showToast(`Đã xóa user ${user}`, 'success');
      fetchMySQLData();
    } catch (err) { console.error(err); }
  };

  const viewTables = async (dbName) => {
    setSelectedDb(dbName);
    setTablesLoading(true);
    try {
      const res = await apiCall('/api/mysql/tables', 'POST', { database: dbName });
      setTables(res.data || []);
    } catch (err) { console.error(err); }
    finally { setTablesLoading(false); }
  };

  const exportDB = async (name) => {
    try {
      showToast(`Đang xuất backup database ${name}...`, 'info');
      const res = await apiCall('/api/mysql/export', 'POST', { name });
      if (res.success && res.data?.remotePath) {
        showToast(`Đã xuất xong! Bắt đầu tải file về máy tính...`, 'success');

        // Kích hoạt download
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/api/files/download';
        form.style.display = 'none';

        const inputPath = document.createElement('input');
        inputPath.name = 'path';
        inputPath.value = res.data.remotePath;
        form.appendChild(inputPath);

        const inputVPS = document.createElement('input');
        inputVPS.name = 'vpsConfig';
        inputVPS.value = JSON.stringify(currentVPS);
        form.appendChild(inputVPS);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      }
    } catch (err) { console.error(err); }
  };

  const importDB = async (name) => {
    if (!importPath.trim()) { showToast('Vui lòng nhập đường dẫn file .sql trên VPS', 'warning'); return; }
    try {
      showToast(`Đang import dữ liệu vào database ${name}...`, 'info');
      await apiCall('/api/mysql/import', 'POST', { name, remotePath: importPath });
      showToast(`Đã import dữ liệu thành công!`, 'success');
      setImportPath('');
      if (selectedDb === name) viewTables(name);
    } catch (err) { console.error(err); }
  };

  const handleUploadAndImport = async (e, dbName) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportingFile(true);
    showToast(`Đang tải file ${file.name} lên VPS...`, 'info');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('remotePath', '/tmp');
    formData.append('vpsConfig', JSON.stringify(currentVPS));

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Tải file lên thất bại');
      }

      const remotePath = result.path; // path on VPS
      showToast(`Đã tải lên! Đang import dữ liệu vào database ${dbName}...`, 'info');

      // Import database
      await apiCall('/api/mysql/import', 'POST', { name: dbName, remotePath });
      showToast(`Đã nạp (import) dữ liệu thành công!`, 'success');

      // Cleanup remote file
      try {
        await apiCall('/api/files/delete', 'POST', { path: remotePath });
      } catch (cleanupErr) {
        console.error('Không thể dọn dẹp file SQL tạm trên VPS:', cleanupErr);
      }

      if (selectedDb === dbName) viewTables(dbName);
    } catch (err) {
      showToast(`Lỗi import: ${err.message}`, 'error');
    } finally {
      setImportingFile(false);
      // Reset input value to allow selecting same file again
      e.target.value = '';
    }
  };

  const handleRepairSystem = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn khôi phục các tài khoản hệ thống MySQL?')) return;
    try {
      showToast('Đang khôi phục tài khoản hệ thống...', 'info');
      const res = await apiCall('/api/mysql/repair-system', 'POST');
      showToast(res.message || 'Khôi phục thành công!', 'success');
      fetchMySQLData();
    } catch (err) { console.error(err); }
  };

  // ─── Phase 5 Handlers ───
  const openGrantModal = async (u) => {
    setGrantModal(u);
    setGrantDb('*');
    setGrantPrivs(['ALL PRIVILEGES']);
    setGrantAllPrivs(true);
    setGrantsLoading(true);
    try {
      const res = await apiCall('/api/mysql/users/grants', 'POST', { user: u.user, host: u.host });
      setUserGrants(res.data || []);
    } catch (err) { setUserGrants([]); }
    finally { setGrantsLoading(false); }
  };

  const handleGrant = async (action) => {
    if (!grantModal) return;
    setGrantLoading(true);
    try {
      const privs = grantAllPrivs ? ['ALL PRIVILEGES'] : grantPrivs;
      const res = await apiCall('/api/mysql/users/grant', 'POST', {
        user: grantModal.user, host: grantModal.host,
        database: grantDb, privileges: privs, action
      });
      showToast(res.message, 'success');
      // Refresh grants display
      const gr = await apiCall('/api/mysql/users/grants', 'POST', { user: grantModal.user, host: grantModal.host });
      setUserGrants(gr.data || []);
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally { setGrantLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwModal) return;
    setPwLoading(true);
    try {
      const res = await apiCall('/api/mysql/users/change-password', 'POST', {
        user: pwModal.user, host: pwModal.host, newPassword: newPw
      });
      showToast(res.message, 'success');
      setPwModal(null);
      setNewPw('');
    } catch (err) {
      showToast('Lỗi đổi mật khẩu: ' + err.message, 'error');
    } finally { setPwLoading(false); }
  };

  const togglePrivilege = (priv) => {
    setGrantPrivs(prev => prev.includes(priv) ? prev.filter(p => p !== priv) : [...prev, priv]);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Cơ sở dữ liệu MySQL</h1>
          <p className="text-sm text-gray-400 font-medium">Quản lý cơ sở dữ liệu, người dùng, phân quyền và backup</p>
        </div>
        <button onClick={fetchMySQLData} disabled={loading} className="btn btn-glass flex items-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="db-tabs-container">
        <button onClick={() => setActiveTab('databases')} className={`db-tab-item ${activeTab === 'databases' ? 'active' : ''}`}>
          <Database size={16} /> Databases ({databases.length})
        </button>
        <button onClick={() => setActiveTab('users')} className={`db-tab-item ${activeTab === 'users' ? 'active' : ''}`}>
          <User size={16} /> Người dùng ({users.length})
        </button>
        <button onClick={() => setActiveTab('privileges')} className={`db-tab-item ${activeTab === 'privileges' ? 'active' : ''}`}>
          <Shield size={16} /> Phân quyền & Mật khẩu
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải dữ liệu MySQL...</div>
      ) : activeTab === 'databases' ? (
        <div className="db-layout-container">
          <div className="db-layout-main">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Database size={18} className="text-indigo-400" />
                Danh sách Database
              </h2>
              {databases.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Không tìm thấy database nào tự tạo.</p>
              ) : (
                <div className="db-list-wrapper">
                  {databases.map((db) => (
                    <div key={db} className="db-list-item">
                      <div className="db-item-details">
                        <Database size={20} className="text-indigo-300" />
                        <div>
                          <span style={{ fontWeight: 600, display: 'block' }}>{db}</span>
                          <button onClick={() => viewTables(db)} style={{ background: 'none', border: 'none', padding: 0 }}
                            className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-1 cursor-pointer">
                            <Table size={12} /> Xem bảng dữ liệu
                          </button>
                        </div>
                      </div>
                      <div className="db-item-actions">
                        <button onClick={() => exportDB(db)} title="Backup (.sql)" className="btn btn-glass text-green-400" style={{ padding: '6px' }}>
                          <Download size={14} />
                        </button>
                        <button onClick={() => handleDeleteDB(db)} title="Xóa database" className="btn btn-glass text-red-400" style={{ padding: '6px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedDb && (
              <div className="card-glass p-6 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Table size={18} className="text-indigo-400" />
                    Các bảng: <span className="text-indigo-300">{selectedDb}</span>
                  </h3>
                  <button onClick={() => setSelectedDb(null)} className="text-xs text-gray-400 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Đóng</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="db-import-tools">
                  <div className="db-import-tool">
                    <span className="text-xs font-semibold block text-gray-300">Nhập dữ liệu (Import SQL từ VPS)</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <input type="text" placeholder="VD: /tmp/backup.sql" value={importPath} onChange={(e) => setImportPath(e.target.value)} className="input-glass" style={{ padding: '8px 12px', fontSize: '12px' }} />
                      <button onClick={() => importDB(selectedDb)} className="btn btn-glass text-indigo-300" style={{ padding: '8px 12px', fontSize: '12px' }}>
                        <Upload size={13} /> Import
                      </button>
                    </div>
                  </div>

                  <div className="db-import-tool">
                    <span className="text-xs font-semibold block text-gray-300">Nhập dữ liệu (Import SQL từ máy tính)</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                      <label className="btn btn-glass text-green-400 cursor-pointer flex items-center gap-1.5" style={{ fontSize: '12px', padding: '8px 12px' }}>
                        <Upload size={13} />
                        {importingFile ? 'Đang nạp...' : 'Chọn file .sql & Import'}
                        <input 
                          type="file" 
                          accept=".sql" 
                          onChange={(e) => handleUploadAndImport(e, selectedDb)} 
                          className="hidden" 
                          disabled={importingFile} 
                        />
                      </label>
                      <span className="text-[10px] text-gray-400 leading-tight">File sẽ được tải lên VPS tạm thời và giải phóng tự động.</span>
                    </div>
                  </div>
                </div>
                {tablesLoading ? (
                  <p className="text-sm text-gray-400">Đang truy vấn danh sách bảng...</p>
                ) : tables.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">Database trống.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="explorer-list-table">
                      <thead><tr><th>Tên bảng</th><th style={{ textAlign: 'right' }}>Số bản ghi</th><th style={{ textAlign: 'right' }}>Dung lượng</th></tr></thead>
                      <tbody>
                        {tables.map((t) => (
                          <tr key={t.name}>
                            <td className="font-mono text-xs">{t.name}</td>
                            <td style={{ textAlign: 'right' }} className="font-mono text-xs text-gray-300">{t.rows}</td>
                            <td style={{ textAlign: 'right' }} className="font-mono text-xs text-indigo-300">{t.size}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="db-layout-sidebar">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Plus size={18} className="text-green-400" /> Tạo Database mới</h2>
              <form onSubmit={handleCreateDB} className="space-y-3">
                <div className="form-group">
                  <label>Tên Database</label>
                  <input type="text" required value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="vd: project_db" className="input-glass" />
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ padding: '10px' }}><Plus size={14} /> Tạo Database</button>
              </form>
            </div>
            <div className="db-warning-card mt-4">
              <ShieldAlert className="db-warning-icon" size={24} />
              <div className="db-warning-text">
                <span className="db-warning-title">Lưu ý bảo mật</span>
                <p>Các database hệ thống (mysql, performance_schema...) đã bị ẩn nhằm đảm bảo an toàn vận hành.</p>
              </div>
            </div>
            <div className="db-warning-card border-amber-500/20 bg-amber-500/5 mt-4">
              <ShieldAlert className="db-warning-icon text-amber-400" size={24} />
              <div className="db-warning-text">
                <span className="db-warning-title text-amber-400">Sửa lỗi MySQL System</span>
                <p className="text-xs text-gray-400 mt-1 mb-2">Nếu bạn lỡ tay xóa tài khoản hệ thống làm lỗi truy vấn, hãy bấm nút dưới đây để khôi phục.</p>
                <button type="button" onClick={handleRepairSystem} className="btn btn-glass btn-sm text-amber-300 border-amber-500/30 hover:bg-amber-500/20 text-[11px] py-1 px-2.5 rounded">
                  Khôi phục tài khoản hệ thống
                </button>
              </div>
            </div>
          </div>
        </div>

      ) : activeTab === 'users' ? (
        <div className="db-layout-container">
          <div className="db-layout-main">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><User size={18} className="text-indigo-400" /> Danh sách tài khoản MySQL</h2>
              {users.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Không có tài khoản người dùng tùy chỉnh nào.</p>
              ) : (
                <div className="db-list-wrapper">
                  {users.map((u) => (
                    <div key={`${u.user}-${u.host}`} className="db-list-item">
                      <div className="db-item-details">
                        <Key size={18} className="text-indigo-300" />
                        <div>
                          <span style={{ fontWeight: 600, display: 'block' }}>{u.user}</span>
                          <span className="text-xs text-gray-400 block">Host: <code className="bg-white/10 px-1 rounded" style={{ userSelect: 'text' }}>{u.host}</code></span>
                        </div>
                      </div>
                      <div className="db-item-actions">
                        <button onClick={() => { setPwModal(u); setNewPw(''); setShowPw(false); }} title="Đổi mật khẩu" className="btn btn-glass text-yellow-400" style={{ padding: '6px' }}>
                          <Lock size={14} />
                        </button>
                        <button onClick={() => openGrantModal(u)} title="Phân quyền" className="btn btn-glass text-indigo-400" style={{ padding: '6px' }}>
                          <Shield size={14} />
                        </button>
                        <button onClick={() => handleDeleteUser(u.user, u.host)} title="Xóa tài khoản" className="btn btn-glass text-red-400" style={{ padding: '6px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="db-layout-sidebar">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Plus size={18} className="text-green-400" /> Thêm tài khoản</h2>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="form-group"><label>Tài khoản</label>
                  <input type="text" required value={dbUser} onChange={(e) => setDbUser(e.target.value)} placeholder="vd: project_user" className="input-glass" />
                </div>
                <div className="form-group"><label>Mật khẩu</label>
                  <input type="password" required value={dbPass} onChange={(e) => setDbPass(e.target.value)} placeholder="Mật khẩu bảo mật" className="input-glass" />
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ padding: '10px' }}><Plus size={14} /> Thêm tài khoản</button>
              </form>
            </div>
            <div className="db-warning-card mt-4">
              <ShieldAlert className="db-warning-icon" size={24} />
              <div className="db-warning-text">
                <span className="db-warning-title">Mẹo</span>
                <p>Bấm nút <Shield size={11} style={{display:'inline',verticalAlign:'middle'}} className="text-indigo-400 mx-1"/> để quản lý quyền truy cập database cho từng user. Bấm <Lock size={11} style={{display:'inline',verticalAlign:'middle'}} className="text-yellow-400 mx-1"/> để đổi mật khẩu.</p>
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* Tab Privileges */
        <div className="space-y-4">
          <div className="card-glass p-5 rounded-xl">
            <h2 className="text-base font-bold flex items-center gap-2 mb-1" style={{ color: '#e2e8f0' }}>
              <Shield size={18} style={{ color: '#818cf8' }} />
              Bảng phân quyền nhanh (Quick Grant)
            </h2>
            <p className="text-xs mb-4" style={{ color: '#6b7280' }}>Chọn user và database để cấp hoặc thu hồi quyền truy cập ngay lập tức.</p>

            {users.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Chưa có user nào. Hãy tạo user trong tab Người dùng.</p>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div key={`${u.user}-${u.host}`} className="p-4 rounded-xl border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <span className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>{u.user}</span>
                        <span className="text-xs ml-2" style={{ color: '#6b7280' }}>@{u.host}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openGrantModal(u)}
                          className="btn btn-glass"
                          style={{ fontSize: '11px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px', color: '#818cf8' }}
                        >
                          <Shield size={13} /> Quản lý quyền
                        </button>
                        <button
                          onClick={() => { setPwModal(u); setNewPw(''); setShowPw(false); }}
                          className="btn btn-glass"
                          style={{ fontSize: '11px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24' }}
                        >
                          <Lock size={13} /> Đổi mật khẩu
                        </button>
                      </div>
                    </div>

                    {/* Quick grant per database */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs" style={{ color: '#6b7280', alignSelf: 'center' }}>Cấp nhanh:</span>
                      {databases.map(db => (
                        <button
                          key={db}
                          onClick={async () => {
                            try {
                              const res = await apiCall('/api/mysql/users/grant', 'POST', {
                                user: u.user, host: u.host, database: db,
                                privileges: ['ALL PRIVILEGES'], action: 'grant'
                              });
                              showToast(`Đã cấp ALL PRIVILEGES trên ${db} cho ${u.user}`, 'success');
                            } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
                          }}
                          style={{
                            fontSize: '10px', padding: '3px 8px', borderRadius: '5px',
                            background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                            border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer'
                          }}
                        >
                          ALL → {db}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Grant Privileges Modal ─── */}
      {grantModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '560px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h2 className="flex items-center gap-2"><Shield size={18} className="text-indigo-400" /> Phân quyền: <span className="text-indigo-300">{grantModal.user}</span>@{grantModal.host}</h2>
              <button onClick={() => setGrantModal(null)} className="modal-close-btn">✕</button>
            </div>
            <div className="modal-body space-y-4" style={{ padding: '16px' }}>

              {/* Current grants */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#9ca3af' }}>QUYỀN HIỆN TẠI (SHOW GRANTS)</p>
                {grantsLoading ? (
                  <p className="text-xs text-gray-400">Đang tải...</p>
                ) : userGrants.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Chưa có quyền nào.</p>
                ) : (
                  <div className="space-y-1">
                    {userGrants.map((g, i) => (
                      <code key={i} className="block text-xs p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: '#6ee7b7', wordBreak: 'break-all' }}>{g}</code>
                    ))}
                  </div>
                )}
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

              {/* Grant form */}
              <div className="space-y-3">
                <div className="form-group">
                  <label className="text-xs">Database mục tiêu</label>
                  <select value={grantDb} onChange={e => setGrantDb(e.target.value)} className="input-glass">
                    <option value="*">* (Tất cả databases)</option>
                    {databases.map(db => <option key={db} value={db}>{db}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: '#9ca3af' }}>Quyền</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={grantAllPrivs} onChange={e => setGrantAllPrivs(e.target.checked)} className="rounded" />
                    <span className="text-sm font-semibold" style={{ color: '#34d399' }}>ALL PRIVILEGES (Toàn quyền)</span>
                  </label>
                  {!grantAllPrivs && (
                    <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr', maxHeight: '180px', overflowY: 'auto' }}>
                      {PRIVILEGE_OPTIONS.map(priv => (
                        <label key={priv} className="flex items-center gap-1.5 cursor-pointer text-xs" style={{ color: grantPrivs.includes(priv) ? '#a5b4fc' : '#9ca3af' }}>
                          <input type="checkbox" checked={grantPrivs.includes(priv)} onChange={() => togglePrivilege(priv)} className="rounded" />
                          {priv}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ gap: '8px' }}>
              <button onClick={() => handleGrant('revoke')} disabled={grantLoading} className="btn btn-glass text-red-400">
                {grantLoading ? '...' : '🚫 Thu hồi quyền'}
              </button>
              <button onClick={() => handleGrant('grant')} disabled={grantLoading} className="btn btn-primary">
                {grantLoading ? 'Đang xử lý...' : '✅ Cấp quyền'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Change Password Modal ─── */}
      {pwModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '420px', maxWidth: '95%' }}>
            <div className="modal-header">
              <h2 className="flex items-center gap-2"><Lock size={16} className="text-yellow-400" /> Đổi mật khẩu: <span className="text-yellow-300">{pwModal.user}</span></h2>
              <button onClick={() => setPwModal(null)} className="modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="modal-body space-y-4" style={{ padding: '16px' }}>
                <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fde68a' }}>
                  ⚠️ Đổi mật khẩu sẽ ngay lập tức áp dụng. Đảm bảo bạn đã cập nhật file cấu hình ứng dụng (wp-config.php, .env...) nếu user này đang được dùng bởi website.
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới (tối thiểu 6 ký tự)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="Nhập mật khẩu mới..."
                      className="input-glass"
                      style={{ paddingRight: '40px' }}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPw && (
                    <div className="mt-1 flex gap-1">
                      {['Yếu', 'Trung bình', 'Mạnh'].map((label, i) => (
                        <div key={i} className="h-1 flex-1 rounded-full" style={{
                          background: newPw.length >= (i + 1) * 4 && (i === 0 ? true : i === 1 ? newPw.length >= 8 : newPw.length >= 12 && /[A-Z]/.test(newPw) && /[0-9]/.test(newPw))
                            ? i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#10b981'
                            : 'rgba(255,255,255,0.1)'
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setPwModal(null)} className="btn btn-glass">Hủy</button>
                <button type="submit" disabled={pwLoading || newPw.length < 6} className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  {pwLoading ? 'Đang xử lý...' : '🔑 Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
