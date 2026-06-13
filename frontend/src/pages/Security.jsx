import React, { useState, useEffect } from 'react';
import { useVPS } from '../context/VPSContext';
import { Shield, ShieldAlert, Plus, Trash2, Power, RefreshCw, Server, AlertTriangle } from 'lucide-react';

export default function Security() {
  const { apiCall, showToast } = useVPS();
  const [ufwActive, setUfwActive] = useState(false);
  const [ufwRules, setUfwRules] = useState([]);
  const [fail2banActive, setFail2banActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add rule state
  const [portInput, setPortInput] = useState('');
  const [protoInput, setProtoInput] = useState('tcp');

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  const fetchSecurityStatus = async () => {
    setLoading(true);
    try {
      const ufwRes = await apiCall('/api/security/ufw/status', 'POST');
      setUfwActive(ufwRes.data?.active || false);
      setUfwRules(ufwRes.data?.rules || []);

      const f2bRes = await apiCall('/api/security/fail2ban/status', 'POST');
      setFail2banActive(f2bRes.data?.active || false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUFW = async () => {
    const action = ufwActive ? 'disable' : 'enable';
    if (action === 'enable' && !window.confirm('Kích hoạt UFW sẽ tự động mở port 22/tcp (SSH). Tiếp tục?')) return;
    try {
      showToast(`Đang thực hiện ${action === 'enable' ? 'kích hoạt' : 'vô hiệu hóa'} UFW...`, 'info');
      await apiCall(`/api/security/ufw/${action}`, 'POST');
      showToast(`Đã ${action === 'enable' ? 'bật' : 'tắt'} Tường lửa UFW`, 'success');
      fetchSecurityStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!portInput.trim()) return;
    try {
      await apiCall('/api/security/ufw/add', 'POST', {
        port: portInput,
        proto: protoInput
      });
      showToast(`Đã tạo luật mở port ${portInput}/${protoInput}`, 'success');
      setPortInput('');
      fetchSecurityStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (index) => {
    if (!window.confirm(`Bạn có chắc muốn xóa luật số #${index}?`)) return;
    try {
      await apiCall('/api/security/ufw/delete', 'POST', { index });
      showToast(`Đã xóa luật UFW thành công`, 'success');
      fetchSecurityStatus();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="explorer-header">
        <div className="explorer-header-title">
          <h1 className="text-2xl font-bold tracking-tight font-outfit">Tường lửa & Bảo mật</h1>
          <p className="text-sm text-gray-400">Giám sát trạng thái tệp chặn UFW, Fail2ban và cấu hình cổng truy cập</p>
        </div>
        <button
          onClick={fetchSecurityStatus}
          disabled={loading}
          className="btn btn-glass flex items-center gap-2"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      <div className="grid-2">
        {/* UFW Panel */}
        <div className="card-glass p-6 rounded-xl flex flex-col justify-between" style={{ minHeight: '190px' }}>
          <div className="space-y-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={22} className={ufwActive ? 'text-green-400' : 'text-red-400'} />
                <h2 className="text-lg font-semibold">Tường lửa UFW</h2>
              </div>
              <span className={`status-badge ${ufwActive ? 'success' : 'danger'}`}>
                {ufwActive ? 'Đang hoạt động' : 'Tắt'}
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">UFW (Uncomplicated Firewall) giúp giới hạn các kết nối mạng bất hợp pháp tới VPS của bạn.</p>
          </div>
          <button
            onClick={toggleUFW}
            className={`btn btn-block ${ufwActive ? 'btn-danger' : 'btn-success'}`}
            style={{ marginTop: '16px', padding: '10px' }}
          >
            <Power size={16} />
            {ufwActive ? 'Vô hiệu hóa Tường lửa' : 'Kích hoạt Tường lửa'}
          </button>
        </div>

        {/* Fail2Ban Panel */}
        <div className="card-glass p-6 rounded-xl flex flex-col justify-between" style={{ minHeight: '190px' }}>
          <div className="space-y-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} className={fail2banActive ? 'text-green-400' : 'text-yellow-400'} />
                <h2 className="text-lg font-semibold">Fail2Ban Service</h2>
              </div>
              <span className={`status-badge ${fail2banActive ? 'success' : 'warning'}`}>
                {fail2banActive ? 'Đang hoạt động' : 'Chưa cài đặt/Tắt'}
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">Tự động phát hiện và chặn các địa chỉ IP thực hiện thử sai mật khẩu nhiều lần qua SSH.</p>
          </div>
          <div className="db-warning-card" style={{ marginTop: '16px', padding: '8px 12px' }}>
            <AlertTriangle size={16} className="db-warning-icon text-yellow-400 shrink-0" />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chỉ có thể điều khiển trực tiếp qua SSH / terminal.</span>
          </div>
        </div>
      </div>

      {ufwActive && (
        <div className="db-layout-container">
          {/* Rules List */}
          <div className="db-layout-main card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Server size={18} className="text-indigo-400" />
              Luật Tường lửa UFW
            </h3>
            {ufwRules.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Không có luật mở port tùy chỉnh nào đang được áp dụng.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="explorer-list-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Mã</th>
                      <th>Cổng (To)</th>
                      <th>Hành động</th>
                      <th>Nguồn (From)</th>
                      <th style={{ textAlign: 'center', width: '60px' }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ufwRules.map((rule) => (
                      <tr key={rule.index}>
                        <td className="font-mono text-xs text-gray-400">#{rule.index}</td>
                        <td className="font-semibold text-indigo-300">{rule.to}</td>
                        <td>
                          <span className={`status-badge ${rule.action === 'ALLOW' ? 'success' : 'danger'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                            {rule.action}
                          </span>
                        </td>
                        <td className="text-gray-300">{rule.from}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteRule(rule.index)}
                            className="btn btn-glass text-red-400"
                            style={{ padding: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Rule Form */}
          <div className="db-layout-sidebar card-glass p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Plus size={18} className="text-green-400" />
              Mở cổng Tường lửa
            </h3>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div className="form-group">
                <label>Cổng cần mở (Port)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 80, 443, 3000-3010"
                  value={portInput}
                  onChange={(e) => setPortInput(e.target.value)}
                  className="input-glass"
                />
              </div>

              <div className="form-group">
                <label>Giao thức</label>
                <select
                  value={protoInput}
                  onChange={(e) => setProtoInput(e.target.value)}
                  className="input-glass"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="any">Bất kỳ (Both TCP/UDP)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-success btn-block"
                style={{ padding: '10px' }}
              >
                <Plus size={14} />
                Áp dụng quy tắc mới
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
