import React, { useState } from 'react';
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
  Rocket,
  Webhook,
  ChevronDown,
  ChevronRight,
  Cloud
} from 'lucide-react';

export default function Sidebar() {
  const { currentVPS, activePage, setActivePage, disconnectVPS, isConnected, isPanelProtected, logoutPanel } = useVPS();

  // Track expanded sections
  const [expandedGroups, setExpandedGroups] = useState({
    'Hệ thống & Giám sát': true,
    'Quản lý Dịch vụ': true,
    'Ứng dụng & CSDL': true,
    'Cấu hình & Bảo trì': true,
  });

  const toggleGroup = (groupTitle) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupTitle]: !prev[groupTitle]
    }));
  };

  const MENU_GROUPS = [
    {
      title: 'Hệ thống & Giám sát',
      items: [
        { id: 'dashboard', label: 'Tổng quan', icon: Gauge },
        { id: 'centralmonitor', label: 'Giám sát trung tâm', icon: Cloud },
        { id: 'stats', label: 'Thống kê truy cập', icon: BarChart2 },
        { id: 'terminal', label: 'Terminal (SSH)', icon: Terminal },
        { id: 'alerts', label: 'Cảnh báo hệ thống', icon: Bell }
      ]
    },
    {
      title: 'Quản lý Dịch vụ',
      items: [
        { id: 'services', label: 'Cài đặt Dịch vụ', icon: Cpu },
        { id: 'webserver', label: 'Web Server', icon: Globe },
        { id: 'phpconfig', label: 'Cấu hình PHP', icon: Sliders },
        { id: 'mailconfig', label: 'Mail Server', icon: Mail },
        { id: 'docker', label: 'Docker', icon: Play }
      ]
    },
    {
      title: 'Ứng dụng & CSDL',
      items: [
        { id: 'installer', label: 'Cài đặt 1-Click', icon: Rocket },
        { id: 'mysql', label: 'Quản lý MySQL', icon: Database },
        { id: 'applications', label: 'Quản lý Ứng dụng', icon: Layers },
        { id: 'nodeconfig', label: 'Quản lý Node.js', icon: Zap },
        { id: 'files', label: 'Quản lý File', icon: FolderOpen }
      ]
    },
    {
      title: 'Cấu hình & Bảo trì',
      items: [
        { id: 'security', label: 'Bảo mật', icon: Shield },
        { id: 'scheduler', label: 'Lập lịch Cron', icon: Clock },
        { id: 'backups', label: 'Sao lưu & Đám mây', icon: Cloud },
        { id: 'scripts', label: 'Chạy Scripts', icon: TerminalSquare },
        { id: 'webhooks', label: 'Git Webhooks', icon: Webhook },
        { id: 'maintenance', label: 'Bảo trì hệ thống', icon: Wrench }
      ]
    }
  ];

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

      <nav className="nav-menu" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {MENU_GROUPS.map(group => {
          const isExpanded = expandedGroups[group.title];
          return (
            <div key={group.title} style={{ display: 'flex', flexDirection: 'column' }}>
              <div 
                className="sidebar-group-header" 
                onClick={() => toggleGroup(group.title)}
              >
                <span>{group.title}</span>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
              <div 
                className="sidebar-group-content"
                style={{ 
                  maxHeight: isExpanded ? `${group.items.length * 44}px` : '0px',
                  opacity: isExpanded ? 1 : 0,
                  pointerEvents: isExpanded ? 'auto' : 'none'
                }}
              >
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <div 
                      key={item.id} 
                      className={`sidebar-subitem ${isActive ? 'active' : ''}`}
                      onClick={() => setActivePage(item.id)}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
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
