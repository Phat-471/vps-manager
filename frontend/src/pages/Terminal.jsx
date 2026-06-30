import React, { useEffect, useRef, useState } from 'react';
import { useVPS } from '../context/VPSContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Play, Plus, Trash2, Terminal as TermIcon } from 'lucide-react';

const SYSTEM_SNIPPETS = [
  { name: 'Kiểm tra ổ đĩa', cmd: 'df -h', desc: 'Xem dung lượng đĩa trống' },
  { name: 'Kiểm tra RAM', cmd: 'free -h', desc: 'Xem dung lượng RAM sử dụng' },
  { name: 'Tải CPU / Tiến trình', cmd: 'top -b -n 1 | head -n 20', desc: 'Xem top 20 dòng cpu load' },
  { name: 'Trạng thái Docker', cmd: 'docker ps -a', desc: 'Liệt kê các container' },
  { name: 'Khởi động lại Nginx', cmd: 'systemctl restart nginx', desc: 'Restart dịch vụ Web Server' },
  { name: 'Khởi động lại MySQL', cmd: 'systemctl restart mysql', desc: 'Restart cơ sở dữ liệu MySQL' },
];

export default function Terminal() {
  const { socket, currentVPS } = useVPS();
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  // Snippets States
  const [customSnippets, setCustomSnippets] = useState(() => {
    try {
      const saved = localStorage.getItem('vps_custom_snippets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetCmd, setNewSnippetCmd] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    localStorage.setItem('vps_custom_snippets', JSON.stringify(customSnippets));
  }, [customSnippets]);

  useEffect(() => {
    if (!socket || !terminalRef.current) return;

    // Initialize xterm.js terminal instance
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Courier New, Courier, monospace',
      theme: {
        background: 'rgba(0, 0, 0, 0.75)',
        foreground: '#f8f8f2',
        cursor: '#f8f8f0',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('Đang kết nối SSH Terminal...');

    // Emit event to create terminal process on server
    socket.emit('terminal:create', currentVPS);

    // Event listeners
    socket.on('terminal:ready', () => {
      term.reset();
      term.writeln('\x1b[1;32m✓ Đã kết nối SSH Terminal! (IP: ' + currentVPS.host + ')\x1b[0m\r\n');
    });

    socket.on('terminal:data', (data) => {
      term.write(data);
    });

    socket.on('terminal:error', ({ error }) => {
      term.writeln('\r\n\x1b[1;31m✖ Lỗi terminal: ' + error + '\x1b[0m\r\n');
    });

    socket.on('terminal:closed', () => {
      term.writeln('\r\n\x1b[1;33m✖ Terminal session đã bị ngắt từ VPS.\x1b[0m\r\n');
    });

    // Write input to server
    term.onData((data) => {
      socket.emit('terminal:input', data);
    });

    // Handle resizing window via ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        socket.emit('terminal:resize', {
          cols: term.cols,
          rows: term.rows,
        });
      } catch (e) {
        console.error(e);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Delay initial fit slightly to ensure DOM layout is settled
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {}
    }, 100);

    return () => {
      resizeObserver.disconnect();
      socket.off('terminal:ready');
      socket.off('terminal:data');
      socket.off('terminal:error');
      socket.off('terminal:closed');
      term.dispose();
    };
  }, [socket, currentVPS]);

  const handleRunSnippet = (cmd) => {
    if (socket) {
      // Send the command followed by a carriage return to execute it
      socket.emit('terminal:input', cmd + '\n');
      if (xtermRef.current) {
        xtermRef.current.focus();
      }
    }
  };

  const handleAddSnippet = (e) => {
    e.preventDefault();
    if (!newSnippetName.trim() || !newSnippetCmd.trim()) return;

    setCustomSnippets([
      ...customSnippets,
      {
        name: newSnippetName.trim(),
        cmd: newSnippetCmd.trim(),
        desc: 'Lệnh cá nhân tự định nghĩa'
      }
    ]);
    setNewSnippetName('');
    setNewSnippetCmd('');
    setShowAddForm(false);
  };

  const handleDeleteSnippet = (indexToDelete) => {
    setCustomSnippets(customSnippets.filter((_, idx) => idx !== indexToDelete));
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      <div style={{ flexShrink: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">SSH Terminal</h1>
        <p className="text-sm text-gray-400">Thiết lập kết nối dòng lệnh trực tiếp (SSH Shell) tới VPS</p>
      </div>

      <div className="flex gap-4 overflow-hidden" style={{ flex: 1, minHeight: 0, marginTop: '1rem' }}>
        {/* Terminal Area */}
        {/* Terminal Area */}
        <div className="flex-1 card-glass p-3 rounded-xl overflow-hidden" style={{ height: '100%', width: '100%' }}>
          <div
            ref={terminalRef}
            id="terminal"
            className="w-full h-full rounded-lg overflow-hidden"
            style={{ fontFamily: 'Courier New, Courier, monospace', width: '100%', height: '100%' }}
          />
        </div>

        {/* Snippet Manager Sidebar */}
        <div className="w-80 card-glass p-4 rounded-xl flex flex-col space-y-4 overflow-y-auto max-h-full">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-sm font-bold text-gray-200 flex items-center gap-1.5 font-outfit">
              <TermIcon size={16} className="text-indigo-400" />
              Snippet Manager
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-xs btn-primary p-1 rounded"
              title="Thêm script mẫu cá nhân"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Add custom snippet inline form */}
          {showAddForm && (
            <form onSubmit={handleAddSnippet} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2 animate-fade-in">
              <div className="form-group">
                <label className="text-[10px] text-gray-400 block mb-1">Tên script gợi nhớ:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Restart PM2"
                  value={newSnippetName}
                  onChange={e => setNewSnippetName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="form-group">
                <label className="text-[10px] text-gray-400 block mb-1">Lệnh Shell thực thi:</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: pm2 restart all"
                  value={newSnippetCmd}
                  onChange={e => setNewSnippetCmd(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-gray-200 outline-none font-mono focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 rounded"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-2 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                >
                  Lưu
                </button>
              </div>
            </form>
          )}

          {/* Custom Snippets */}
          {customSnippets.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Lệnh cá nhân</h3>
              <div className="space-y-1.5">
                {customSnippets.map((snippet, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 rounded-lg group transition-all">
                    <div className="overflow-hidden mr-2">
                      <span className="text-xs font-bold text-gray-200 block truncate">{snippet.name}</span>
                      <code className="text-[10px] text-gray-400 font-mono block truncate" title={snippet.cmd}>{snippet.cmd}</code>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRunSnippet(snippet.cmd)}
                        className="p-1 hover:bg-green-500/20 text-green-400 rounded"
                        title="Chạy lệnh"
                      >
                        <Play size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteSnippet(idx)}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                        title="Xóa lệnh"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Snippets */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Hệ thống gợi ý</h3>
            <div className="space-y-1.5">
              {SYSTEM_SNIPPETS.map((snippet, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg group transition-all">
                  <div className="overflow-hidden mr-2">
                    <span className="text-xs font-bold text-gray-200 block truncate">{snippet.name}</span>
                    <code className="text-[10px] text-gray-400 font-mono block truncate" title={snippet.cmd}>{snippet.cmd}</code>
                  </div>
                  <button
                    onClick={() => handleRunSnippet(snippet.cmd)}
                    className="p-1 hover:bg-indigo-500/20 text-indigo-400 rounded shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                    title="Chạy lệnh"
                  >
                    <Play size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
