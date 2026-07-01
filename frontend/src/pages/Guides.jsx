import React, { useState } from 'react';
import { useVPS } from '../context/VPSContext';
import Topbar from '../components/Topbar';
import { 
  BookOpen, 
  Layers, 
  Zap, 
  Cpu, 
  Server, 
  Database, 
  Globe, 
  ArrowRight, 
  ShieldAlert, 
  FileText, 
  CheckCircle,
  Clock,
  Terminal
} from 'lucide-react';

export default function Guides() {
  const { setActivePage } = useVPS();
  const [activeTab, setActiveTab] = useState('recovery');

  const tabs = [
    { id: 'recovery', label: 'Khôi phục VPS bị hack', icon: ShieldAlert, color: '#ef4444' },
    { id: 'multiapp', label: 'Chạy nhiều ứng dụng', icon: Layers, color: '#6366f1' },
    { id: 'optimization', label: 'Tối ưu tài nguyên VPS', icon: Zap, color: '#eab308' },
  ];

  const handleNavigate = (pageId) => {
    setActivePage(pageId);
  };

  return (
    <div className="content-area">
      <Topbar title="TÀI LIỆU HƯỚNG DẪN & TỐI ƯU" />
      
      <div style={{ padding: '0 4px', maxWidth: '1000px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <BookOpen size={24} style={{ color: '#6366f1' }} />
            Tài liệu & Cấu hình Tối ưu
          </h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Hướng dẫn xử lý sự cố, định tuyến đa tên miền và cấu hình tiết kiệm dung lượng RAM cho máy chủ cấu hình thấp.
          </p>
        </div>

        {/* Tabs switcher */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, flexWrap: 'wrap' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? `1.5px solid ${tab.color}70` : '1px solid rgba(255,255,255,0.08)',
                  background: isActive ? `${tab.color}15` : 'rgba(255,255,255,0.02)',
                  color: isActive ? '#f8fafc' : '#64748b',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={16} style={{ color: isActive ? tab.color : '#64748b' }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab contents */}
        <div className="card-glass p-6 rounded-xl space-y-6" style={{ padding: 24, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          
          {/* TAB 1: RECOVERY */}
          {activeTab === 'recovery' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10 }}>
                <ShieldAlert size={20} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f87171', margin: '0 0 4px 0' }}>Cảnh báo Bảo mật quan trọng</h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                    Khi VPS bị hack, virus/malware hoặc backdoor thường tự nhân bản sâu vào nhân hệ điều hành. Cách duy nhất để dọn dẹp sạch sẽ là <b>Reinstall OS (Cài lại hệ điều hành sạch)</b>. Tuyệt đối không sao lưu đè các tệp hệ thống cũ sang hệ điều hành mới.
                  </p>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>Bước 1: Sao lưu trước khi Reinstall OS</h2>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                  Hãy truy cập Terminal và thực hiện các câu lệnh sau để lưu cơ sở dữ liệu và mã nguồn ra nơi an toàn.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                  <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Database size={14} style={{ color: '#6366f1' }} />
                        Sao lưu MySQL Database (.sql)
                      </span>
                      <button type="button" onClick={() => handleNavigate('mysql')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Đi tới Quản lý MySQL <ArrowRight size={10} />
                      </button>
                    </div>
                    <pre style={{ margin: 0, background: '#0a0a16', padding: 10, borderRadius: 6, color: '#34d399', fontSize: 12, fontFamily: 'monospace', overflowX: 'auto' }}>
                      mysqldump -u [db_user] -p[db_password] [db_name] &gt; backup.sql
                    </pre>
                  </div>

                  <div style={{ padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={14} style={{ color: '#10b981' }} />
                        Nén thư mục mã nguồn sạch
                      </span>
                      <button type="button" onClick={() => handleNavigate('files')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Mở Trình quản lý File <ArrowRight size={10} />
                      </button>
                    </div>
                    <pre style={{ margin: 0, background: '#0a0a16', padding: 10, borderRadius: 6, color: '#34d399', fontSize: 12, fontFamily: 'monospace', overflowX: 'auto' }}>
                      tar -czf /tmp/source_backup.tar.gz -C /var/www [ten_thu_muc_web]
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>Bước 2: Cài lại OS và Khôi phục qua Panel</h2>
                <ol style={{ fontSize: 13, color: '#94a3b8', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.6 }}>
                  <li>Cài lại phiên bản <b>Ubuntu sạch</b> thông qua trang quản trị của nhà cung cấp VPS.</li>
                  <li>Cài lại Panel VPS Manager bằng lệnh 1-Click hiển thị ở trang chủ.</li>
                  <li>
                    Truy cập trang <a onClick={() => handleNavigate('webserver')} style={{ color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}>Web Server</a> và thêm lại Website (Domain) của bạn. Hệ thống sẽ tự động sinh file cấu hình Nginx chuẩn, an toàn và sạch sẽ.
                  </li>
                  <li>
                    Truy cập trang <a onClick={() => handleNavigate('mysql')} style={{ color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}>MySQL</a> và tạo lại CSDL + User tương ứng. Tiến hành Import tệp `.sql` đã lưu về.
                  </li>
                  <li>
                    Sử dụng <a onClick={() => handleNavigate('files')} style={{ color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}>Quản lý File</a> tải lại source code sạch lên, giải nén và phân quyền lại cho Nginx.
                  </li>
                  <li>Bật lại SSL chỉ với 1-Click trên trang Web Server để bảo mật đường truyền.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: MULTIAPP */}
          {activeTab === 'multiapp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>Chạy nhiều ứng dụng trên 1 VPS</h2>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  VPS Manager hỗ trợ phân luồng định tuyến tự động cho nhiều dự án khác nhau (PHP, Node.js, HTML, Docker...) chạy cùng lúc trên máy chủ.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Globe size={16} style={{ color: '#6366f1' }} />
                    1. Nginx Virtual Hosts
                  </h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                    Trỏ nhiều domain khác nhau về IP VPS. Khi thêm web vào Panel, Nginx sẽ tự tạo cấu hình ảo hóa riêng biệt để đưa client tới đúng thư mục mã nguồn tương ứng.
                  </p>
                  <button type="button" onClick={() => handleNavigate('webserver')} style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, color: '#a5b4fc', fontSize: 11, cursor: 'pointer' }}>
                    Quản lý Website Nginx
                  </button>
                </div>

                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Server size={16} style={{ color: '#10b981' }} />
                    2. Định tuyến Cổng (Reverse Proxy)
                  </h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                    Dành cho các ứng dụng chạy trên cổng riêng (Node.js, Python...). App 1 chạy cổng 3000, App 2 chạy cổng 3001. Sử dụng tính năng <b>Reverse Proxy</b> của Web Server để trỏ domain tương ứng vào cổng đó.
                  </p>
                  <button type="button" onClick={() => handleNavigate('webserver')} style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, color: '#6ee7b7', fontSize: 11, cursor: 'pointer' }}>
                    Tạo Website Reverse Proxy
                  </button>
                </div>

                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Zap size={16} style={{ color: '#eab308' }} />
                    3. Quản lý PM2 (Node.js)
                  </h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                    Sử dụng PM2 để quản trị nhiều chương trình Node.js chạy ngầm đồng thời. PM2 sẽ lo việc quản lý log, tự khởi chạy lại khi VPS reboot hoặc khi app bị crash đột ngột.
                  </p>
                  <button type="button" onClick={() => handleNavigate('nodeconfig')} style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, color: '#fef08a', fontSize: 11, cursor: 'pointer' }}>
                    Quản lý Node.js & PM2
                  </button>
                </div>

                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Layers size={16} style={{ color: '#a855f7' }} />
                    4. Docker Containerization
                  </h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                    Chạy các app phức tạp (Grafana, MinIO, Nextcloud) độc lập hoàn toàn trong các container cô lập. Điều này giúp tránh xung đột thư viện dùng chung trên VPS.
                  </p>
                  <button type="button" onClick={() => handleNavigate('docker')} style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: '#e9d5ff', fontSize: 11, cursor: 'pointer' }}>
                    Quản lý Docker Containers
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPTIMIZATION */}
          {activeTab === 'optimization' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>Tối ưu hóa tài nguyên cho VPS cấu hình thấp (dưới 2GB RAM)</h2>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Nếu VPS của bạn chỉ có 1 Core và 1GB RAM, hãy thực hiện các mẹo tối ưu hóa dưới đây để hệ thống luôn vận hành mượt mà, tránh bị treo đơ.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* PM2 */}
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '4px 8px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: 6, fontSize: 10 }}>PM2</span>
                    Tối ưu tiến trình Node.js chạy ngầm
                  </h3>
                  <ul style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5 }}>
                    <li>
                      Sử dụng tham số <code>--max-memory-restart 150M</code> khi start app để tự khởi động lại nếu bộ nhớ rò rỉ vượt giới hạn.
                    </li>
                    <li>
                      Cài đặt module <b>pm2-logrotate</b> tự động giải nén và cắt file logs định kỳ, tránh tình trạng file log phình to làm đầy ổ cứng.
                    </li>
                    <li>
                      Chạy ở <b>Fork mode</b> thay vì Cluster mode trên các VPS ít cores.
                    </li>
                  </ul>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => handleNavigate('nodeconfig')} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, color: '#a5b4fc', fontSize: 11, cursor: 'pointer' }}>
                      Cấu hình PM2
                    </button>
                    <button type="button" onClick={() => handleNavigate('installer')} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
                      Cài PM2 Tối ưu (Eco Mode) <ArrowRight size={10} style={{ marginLeft: 4, display: 'inline-block' }} />
                    </button>
                  </div>
                </div>

                {/* Docker */}
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '4px 8px', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: 6, fontSize: 10 }}>DOCKER</span>
                    Giới hạn tài nguyên Container
                  </h3>
                  <ul style={{ fontSize: 12, color: '#94a3b8', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.5 }}>
                    <li>
                      Luôn chạy container kèm cờ giới hạn RAM, ví dụ: <code>-m 200m --memory-swap 300m</code>.
                    </li>
                    <li>
                      Ưu tiên tải các Image bản rút gọn có hậu tố <code>:alpine</code> hoặc <code>:slim</code> (như nextcloud:alpine, ghost:alpine).
                    </li>
                    <li>
                      Chạy dọn dẹp docker định kỳ để giải phóng ổ cứng bị chiếm bởi log container, cache và image thừa:
                      <pre style={{ margin: '6px 0 0 0', background: '#0a0a16', padding: 8, borderRadius: 6, color: '#34d399', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto' }}>
                        docker system prune -a -f --volumes
                      </pre>
                    </li>
                  </ul>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => handleNavigate('docker')} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, color: '#6ee7b7', fontSize: 11, cursor: 'pointer' }}>
                      Cấu hình Docker
                    </button>
                    <button type="button" onClick={() => handleNavigate('scheduler')} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
                      Lên lịch dọn dẹp Docker tự động <ArrowRight size={10} style={{ marginLeft: 4, display: 'inline-block' }} />
                    </button>
                  </div>
                </div>

                {/* MySQL */}
                <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '4px 8px', background: 'rgba(234,179,8,0.15)', color: '#facc15', borderRadius: 6, fontSize: 10 }}>MYSQL</span>
                    Tối ưu RAM Cơ sở dữ liệu
                  </h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 8px 0' }}>
                    Đối với CSDL MySQL chạy trên VPS 1GB RAM, việc bật <b>Eco Mode</b> khi cài đặt hoặc tắt thủ công <b>Performance Schema</b> trong file cấu hình `/etc/mysql/conf.d/eco.cnf` sẽ giúp <b>tiết kiệm tối thiểu 150MB - 200MB RAM</b>:
                  </p>
                  <pre style={{ margin: 0, background: '#0a0a16', padding: 10, borderRadius: 6, color: '#cbd5e1', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', lineHeight: 1.4 }}>
                    [mysqld]<br />
                    performance_schema = OFF<br />
                    innodb_buffer_pool_size = 64M<br />
                    max_connections = 50
                  </pre>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => handleNavigate('mysql')} style={{ padding: '6px 12px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, color: '#fef08a', fontSize: 11, cursor: 'pointer' }}>
                      Quản lý MySQL
                    </button>
                    <button type="button" onClick={() => handleNavigate('installer')} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
                      Cài đặt lại ở chế độ Eco Mode <ArrowRight size={10} style={{ marginLeft: 4, display: 'inline-block' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
