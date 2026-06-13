import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { Database, User, Trash2, Plus, Download, Upload, ShieldAlert, Table, RefreshCw, Key } from 'lucide-react';

export default function MySQL() {
  const { apiCall, showToast } = useVPS();
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
      if (selectedDb === name) {
        setSelectedDb(null);
        setTables([]);
      }
      fetchMySQLData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (user, host) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa user "${user}"@"${host}"?`)) return;
    try {
      await apiCall('/api/mysql/users/delete', 'POST', { user, host });
      showToast(`Đã xóa user ${user}`, 'success');
      fetchMySQLData();
    } catch (err) {
      console.error(err);
    }
  };

  const viewTables = async (dbName) => {
    setSelectedDb(dbName);
    setTablesLoading(true);
    try {
      const res = await apiCall('/api/mysql/tables', 'POST', { database: dbName });
      setTables(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setTablesLoading(false);
    }
  };

  const exportDB = async (name) => {
    try {
      showToast(`Đang xuất backup database ${name}...`, 'info');
      const res = await apiCall('/api/mysql/export', 'POST', { name });
      showToast(`Đã lưu tệp backup tại VPS: ${res.data.remotePath}`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const importDB = async (name) => {
    if (!importPath.trim()) {
      showToast('Vui lòng nhập đường dẫn file .sql trên VPS', 'warning');
      return;
    }
    try {
      showToast(`Đang import dữ liệu vào database ${name}...`, 'info');
      await apiCall('/api/mysql/import', 'POST', { name, remotePath: importPath });
      showToast(`Đã import dữ liệu thành công!`, 'success');
      setImportPath('');
      if (selectedDb === name) viewTables(name);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepairSystem = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn khôi phục các tài khoản hệ thống MySQL? Hành động này sẽ tạo lại mysql.infoschema, debian-sys-maint và cấp quyền để sửa lỗi hệ thống.')) return;
    try {
      showToast('Đang khôi phục tài khoản hệ thống...', 'info');
      const res = await apiCall('/api/mysql/repair-system', 'POST');
      showToast(res.message || 'Khôi phục tài khoản hệ thống thành công!', 'success');
      fetchMySQLData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight">Cơ sở dữ liệu MySQL</h1>
          <p className="text-sm text-gray-400 font-medium">Quản lý cơ sở dữ liệu, người dùng, bảng và tác vụ backup</p>
        </div>
        <button
          onClick={fetchMySQLData}
          disabled={loading}
          className="btn btn-glass flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Tabs list */}
      <div className="db-tabs-container">
        <button
          onClick={() => setActiveTab('databases')}
          className={`db-tab-item ${activeTab === 'databases' ? 'active' : ''}`}
        >
          <Database size={16} />
          Databases ({databases.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`db-tab-item ${activeTab === 'users' ? 'active' : ''}`}
        >
          <User size={16} />
          Người dùng ({users.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải dữ liệu MySQL...</div>
      ) : activeTab === 'databases' ? (
        <div className="db-layout-container">
          {/* Databases List Column */}
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
                          <button
                            onClick={() => viewTables(db)}
                            style={{ background: 'none', border: 'none', padding: 0 }}
                            className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                          >
                            <Table size={12} />
                            Xem bảng dữ liệu
                          </button>
                        </div>
                      </div>
                      <div className="db-item-actions">
                        <button
                          onClick={() => exportDB(db)}
                          title="Backup (.sql)"
                          className="btn btn-glass text-green-400"
                          style={{ padding: '6px' }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteDB(db)}
                          title="Xóa database"
                          className="btn btn-glass text-red-400"
                          style={{ padding: '6px' }}
                        >
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
                    Các bảng của database: <span className="text-indigo-300">{selectedDb}</span>
                  </h3>
                  <button onClick={() => setSelectedDb(null)} className="text-xs text-gray-400 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    Đóng
                  </button>
                </div>

                {/* Import tool */}
                <div className="db-import-tool">
                  <span className="text-xs font-semibold block text-gray-300">Nhập dữ liệu (Import SQL từ VPS)</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="VD: /tmp/backup.sql"
                      value={importPath}
                      onChange={(e) => setImportPath(e.target.value)}
                      className="input-glass"
                      style={{ padding: '8px 12px' }}
                    />
                    <button
                      onClick={() => importDB(selectedDb)}
                      className="btn btn-glass text-indigo-300"
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                    >
                      <Upload size={13} />
                      Import
                    </button>
                  </div>
                </div>

                {tablesLoading ? (
                  <p className="text-sm text-gray-400">Đang truy vấn danh sách bảng...</p>
                ) : tables.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">Database trống.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="explorer-list-table">
                      <thead>
                        <tr>
                          <th>Tên bảng</th>
                          <th style={{ textAlign: 'right' }}>Số bản ghi</th>
                          <th style={{ textAlign: 'right' }}>Dung lượng</th>
                        </tr>
                      </thead>
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

          {/* Quick Create DB Column */}
          <div className="db-layout-sidebar">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus size={18} className="text-green-400" />
                Tạo Database mới
              </h2>
              <form onSubmit={handleCreateDB} className="space-y-3">
                <div className="form-group">
                  <label>Tên Database</label>
                  <input
                    type="text"
                    required
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    placeholder="vd: project_db"
                    className="input-glass"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ padding: '10px' }}>
                  <Plus size={14} />
                  Tạo Database
                </button>
              </form>
            </div>

            <div className="db-warning-card">
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
                <p className="text-xs text-gray-400 mt-1 mb-2">
                  Nếu bạn lỡ tay xóa tài khoản hệ thống (như <code className="text-amber-300">mysql.infoschema</code>) làm lỗi truy vấn bảng và cài đặt WordPress, hãy bấm nút dưới đây để khôi phục.
                </p>
                <button
                  type="button"
                  onClick={handleRepairSystem}
                  className="btn btn-glass btn-sm text-amber-300 border-amber-500/30 hover:bg-amber-500/20 text-[11px] py-1 px-2.5 rounded"
                >
                  Khôi phục tài khoản hệ thống
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="db-layout-container">
          {/* Users List Column */}
          <div className="db-layout-main">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <User size={18} className="text-indigo-400" />
                Danh sách tài khoản MySQL
              </h2>
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
                          <span className="text-xs text-gray-400 block">Host cho phép: <code className="bg-white/10 px-1 rounded" style={{ userSelect: 'text' }}>{u.host}</code></span>
                        </div>
                      </div>
                      <div className="db-item-actions">
                        <button
                          onClick={() => handleDeleteUser(u.user, u.host)}
                          title="Xóa tài khoản"
                          className="btn btn-glass p-2 text-red-400"
                          style={{ padding: '6px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Create User Column */}
          <div className="db-layout-sidebar">
            <div className="card-glass p-6 rounded-xl space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus size={18} className="text-green-400" />
                Thêm tài khoản
              </h2>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="form-group">
                  <label>Tài khoản</label>
                  <input
                    type="text"
                    required
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    placeholder="vd: project_user"
                    className="input-glass"
                  />
                </div>
                <div className="form-group">
                  <label>Mật khẩu</label>
                  <input
                    type="password"
                    required
                    value={dbPass}
                    onChange={(e) => setDbPass(e.target.value)}
                    placeholder="Mật khẩu bảo mật"
                    className="input-glass"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ padding: '10px' }}>
                  <Plus size={14} />
                  Thêm tài khoản
                </button>
              </form>
            </div>

            <div className="db-warning-card mt-4">
              <ShieldAlert className="db-warning-icon" size={24} />
              <div className="db-warning-text">
                <span className="db-warning-title">Lưu ý bảo mật</span>
                <p>Các tài khoản hệ thống (root, mysql.infoschema, debian-sys-maint...) đã bị ẩn nhằm đảm bảo an toàn vận hành.</p>
              </div>
            </div>

            <div className="db-warning-card border-amber-500/20 bg-amber-500/5 mt-4">
              <ShieldAlert className="db-warning-icon text-amber-400" size={24} />
              <div className="db-warning-text">
                <span className="db-warning-title text-amber-400">Sửa lỗi MySQL System</span>
                <p className="text-xs text-gray-400 mt-1 mb-2">
                  Nếu bạn lỡ tay xóa tài khoản hệ thống (như <code className="text-amber-300">mysql.infoschema</code>) làm lỗi truy vấn bảng và cài đặt WordPress, hãy bấm nút dưới đây để khôi phục.
                </p>
                <button
                  type="button"
                  onClick={handleRepairSystem}
                  className="btn btn-glass btn-sm text-amber-300 border-amber-500/30 hover:bg-amber-500/20 text-[11px] py-1 px-2.5 rounded"
                >
                  Khôi phục tài khoản hệ thống
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
