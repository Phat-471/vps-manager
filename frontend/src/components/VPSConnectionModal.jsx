import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { Database, Plus, Trash, Play, ShieldAlert, KeyRound } from 'lucide-react';

export default function VPSConnectionModal({ isModal = false, onClose }) {
  const { vpsList, saveVPS, deleteVPS, connectToVPS, apiCall, showToast, currentVPS } = useVPS();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [canSave, setCanSave] = useState(false);

  // Reset fields when active
  useEffect(() => {
    setTestResult(null);
    setCanSave(false);
  }, []);

  const handleTestConnection = async () => {
    if (!host || !username || !password) {
      showToast('Vui lòng nhập đầy đủ thông tin IP, Username, Password', 'warning');
      return;
    }

    setTesting(true);
    setTestResult({ status: 'checking', message: 'Đang kiểm tra kết nối SSH...' });

    try {
      const result = await apiCall('/api/vps/test-connection', 'POST', {
        host,
        port: parseInt(port),
        username,
        password
      });

      if (result.success) {
        setTestResult({ status: 'success', message: 'Kết nối thành công!' });
        setCanSave(true);
        showToast('Kết nối SSH thành công', 'success');
      } else {
        setTestResult({ status: 'error', message: result.error || 'Lỗi kết nối SSH' });
        setCanSave(false);
      }
    } catch (err) {
      setTestResult({ status: 'error', message: err.message || 'Lỗi kết nối' });
      setCanSave(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSave) return;

    saveVPS({
      name: name || `VPS ${host}`,
      host,
      port: parseInt(port),
      username,
      password
    });

    if (onClose) onClose();
  };

  const selectVPS = (vps) => {
    // We need to decrypt password when calling connectToVPS, which is handled inside VPSContext
    connectToVPS(vps);
    if (onClose) onClose();
  };

  return (
    <div className={isModal ? "modal-overlay" : "content-area"} style={isModal ? {} : { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ width: '600px', maxWidth: '100%', background: 'rgba(10, 10, 30, 0.75)' }}>
        <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <KeyRound size={18} className="text-primary" /> Kết nối VPS
          </h3>
          {isModal && onClose && (
            <button className="modal-close-btn" onClick={onClose}>×</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: vpsList.length > 0 ? '1fr 1fr' : '1fr', gap: '24px', marginTop: '20px' }}>
          {/* Connection Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Tên VPS</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="VD: VPS Production" required />
            </div>

            <div className="form-group">
              <label>Địa chỉ IP / Hostname</label>
              <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="VD: 192.168.1.1" required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px' }}>
              <div className="form-group">
                <label>Port</label>
                <input type="number" value={port} onChange={e => setPort(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label>Mật khẩu SSH (Password)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu SSH" required />
            </div>

            {testResult && (
              <div style={{
                padding: '10px',
                borderRadius: '6px',
                fontSize: '12px',
                marginTop: '12px',
                background: testResult.status === 'success' ? 'rgba(16,185,129,0.15)' : testResult.status === 'checking' ? 'rgba(6,182,212,0.1)' : 'rgba(239,68,68,0.15)',
                color: testResult.status === 'success' ? '#34d399' : testResult.status === 'checking' ? '#22d3ee' : '#f87171',
                border: `1px solid ${testResult.status === 'success' ? 'rgba(16,185,129,0.2)' : testResult.status === 'checking' ? 'rgba(6,182,212,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}>
                {testResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleTestConnection} disabled={testing} style={{ flex: 1 }}>
                {testing ? 'Đang thử...' : 'Thử kết nối'}
              </button>
              <button type="submit" className="btn btn-primary" disabled={!canSave} style={{ flex: 1 }}>
                Lưu & Kết nối
              </button>
            </div>
          </form>

          {/* Saved VPS List */}
          {vpsList.length > 0 && (
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '20px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                VPS đã lưu ({vpsList.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {vpsList.map(v => (
                  <div key={v.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: currentVPS?.id === v.id ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${currentVPS?.id === v.id ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => selectVPS(v)}>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff' }}>{v.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.username}@{v.host}</div>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteVPS(v.id)} style={{ padding: '6px', background: 'transparent', border: 'none', boxShadow: 'none', color: 'var(--text-muted)' }}>
                      <Trash size={14} className="hover:text-danger" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
