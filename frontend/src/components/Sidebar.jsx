import React from 'react';
import { useVPS } from '../context/VPSContext';
import { 
  Gauge, 
  Cpu, 
  Globe, 
  Database, 
  FolderOpen, 
  Shield, 
  Terminal, 
  Wrench, 
  Layers, 
  TerminalSquare, 
  Play, 
  LogOut,
  Clock,
  BarChart2,
  Bell,
  Sliders,
  Zap,
  Mail,
  Rocket
} from 'lucide-react';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: Gauge },
  { id: 'services', label: 'Cài đặt Dịch vụ', icon: Cpu },
  { id: 'installer', label: 'Cài đặt 1-Click', icon: Rocket },
  { id: 'scripts', label: 'Chạy Scripts', icon: TerminalSquare },
  { id: 'webserver', label: 'Web Server', icon: Globe },
  { id: 'stats', label: 'Thống kê truy cập', icon: BarChart2 },
  { id: 'phpconfig', label: 'Cấu hình PHP', icon: Sliders },
  { id: 'nodeconfig', label: 'Quản lý Node.js', icon: Zap },
  { id: 'mailconfig', label: 'Mail Server', icon: Mail },
  { id: 'mysql', label: 'Quản lý MySQL', icon: Database },
  { id: 'applications', label: 'Quản lý Ứng dụng', icon: Layers },
  { id: 'files', label: 'Quản lý File', icon: FolderOpen },
  { id: 'security', label: 'Bảo mật', icon: Shield },
  { id: 'scheduler', label: 'Lập lịch & Sao lưu', icon: Clock },
  { id: 'alerts', label: 'Cảnh báo hệ thống', icon: Bell },
  { id: 'docker', label: 'Docker', icon: Play },
  { id: 'terminal', label: 'Terminal (SSH)', icon: Terminal },
  { id: 'maintenance', label: 'Bảo trì hệ thống', icon: Wrench },
];

export default function Sidebar() {
  const { currentVPS, activePage, setActivePage, disconnectVPS, isConnected, isPanelProtected, logoutPanel } = useVPS();

  return (
    <aside className="sidebar">
      <div className="logo-container">VPS MANAGER</div>

      {currentVPS && (
        <div className="vps-switcher-widget">
          <div className="vps-switcher-status">
            <span className={`vps-status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <strong className="vps-active-name" title={currentVPS.host}>
              {currentVPS.name || currentVPS.host}
            </strong>
          </div>
          <div className="vps-actions-buttons">
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setActivePage('vps-modal')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Đổi VPS
            </button>
            <button 
              className="btn btn-danger btn-sm" 
              onClick={() => {
                if (window.confirm('Bạn có chắc muốn ngắt kết nối VPS hiện tại?')) {
                  disconnectVPS();
                }
              }}
              style={{ width: '100%', justifyContent: 'center', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none' }}
            >
              <LogOut size={12} /> Ngắt kết nối
            </button>
          </div>
        </div>
      )}

      <nav className="nav-menu">
        {MENU_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <div 
              key={item.id} 
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>

      {isPanelProtected && (
        <div style={{ padding: '12px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '12px' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={logoutPanel}
            style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', border: 'none', display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <LogOut size={14} />
            Đăng xuất Panel
          </button>
        </div>
      )}
    </aside>
  );
}
