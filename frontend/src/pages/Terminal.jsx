import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVPS } from '../context/VPSContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import {
  Play, Plus, Trash2, Terminal as TermIcon,
  RefreshCw, Trash, Wifi, WifiOff, Maximize2, Copy, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Hệ thống snippet mặc định ──────────────────────────────────
const SYSTEM_SNIPPETS = [
  { name: 'Trạng thái hệ thống', cmd: 'top -b -n 1 | head -30', desc: 'Xem tiến trình và CPU' },
  { name: 'Kiểm tra RAM', cmd: 'free -h', desc: 'Bộ nhớ RAM đang dùng' },
  { name: 'Kiểm tra ổ đĩa', cmd: 'df -h', desc: 'Dung lượng ổ đĩa trống' },
  { name: 'Dịch vụ đang chạy', cmd: 'systemctl list-units --type=service --state=running', desc: 'Liệt kê các dịch vụ active' },
  { name: 'Tiến trình ngốn RAM', cmd: "ps aux --sort=-%mem | awk 'NR<=11'", desc: 'Top 10 process dùng nhiều RAM nhất' },
  { name: 'Tiến trình ngốn CPU', cmd: "ps aux --sort=-%cpu | awk 'NR<=11'", desc: 'Top 10 process dùng nhiều CPU nhất' },
  { name: 'Kết nối mạng', cmd: 'ss -tuln', desc: 'Các cổng đang lắng nghe' },
  { name: 'Log hệ thống', cmd: 'journalctl -n 50 --no-pager', desc: '50 dòng log gần nhất' },
  { name: 'Restart Nginx', cmd: 'systemctl restart nginx', desc: 'Khởi động lại Nginx' },
  { name: 'Restart MySQL', cmd: 'systemctl restart mysql', desc: 'Khởi động lại MySQL/MariaDB' },
  { name: 'Restart PM2', cmd: 'pm2 restart all', desc: 'Khởi động lại tất cả apps PM2' },
  { name: 'Giải phóng RAM cache', cmd: 'sync && echo 3 > /proc/sys/vm/drop_caches && free -h', desc: 'Xả bộ nhớ đệm của hệ thống' },
  { name: 'Kiểm tra cronjobs', cmd: 'crontab -l 2>/dev/null; ls /etc/cron.d/ 2>/dev/null', desc: 'Xem tất cả cronjobs' },
  { name: 'Uptime & Load', cmd: 'uptime', desc: 'Thời gian hoạt động và tải hệ thống' },
  { name: 'UFW Status', cmd: 'ufw status numbered', desc: 'Trạng thái tường lửa UFW' },
  { name: 'Docker containers', cmd: 'docker ps -a 2>/dev/null || echo "Docker không có hoặc chưa cài"', desc: 'Danh sách containers Docker' },
];

// Status indicator component
function StatusDot({ connected }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full inline-block ${
          connected
            ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)] animate-pulse'
            : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
        }`}
      />
      <span className={`text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? 'Đã kết nối' : 'Chưa kết nối'}
      </span>
    </span>
  );
}

export default function Terminal() {
  const { socket, currentVPS } = useVPS();

  // Refs
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  // State
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [customSnippets, setCustomSnippets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vps_custom_snippets') || '[]');
    } catch { return []; }
  });
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetCmd, setNewSnippetCmd] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [snippetFilter, setSnippetFilter] = useState('');

  // Persist snippets
  useEffect(() => {
    localStorage.setItem('vps_custom_snippets', JSON.stringify(customSnippets));
  }, [customSnippets]);

  // Init terminal instance once
  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return null;

    // Dispose old instance if exists
    if (xtermRef.current) {
      xtermRef.current.dispose();
    }

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "Courier New", monospace',
      lineHeight: 1.3,
      letterSpacing: 0,
      scrollback: 5000,
      allowTransparency: true,
      theme: {
        background: '#0d0f14',
        foreground: '#e2e8f0',
        cursor: '#a78bfa',
        cursorAccent: '#0d0f14',
        selectionBackground: 'rgba(139, 92, 246, 0.3)',
        black: '#1e2030',
        brightBlack: '#444a6a',
        red: '#ff5f7e',
        brightRed: '#ff7b96',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#fbbf24',
        brightYellow: '#fcd34d',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#a78bfa',
        brightMagenta: '#c4b5fd',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#cbd5e1',
        brightWhite: '#f1f5f9',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    setTimeout(() => { try { fitAddon.fit(); } catch (e) {} }, 50);
    setTimeout(() => { try { fitAddon.fit(); } catch (e) {} }, 300);

    return term;
  }, []);

  // Connect to terminal
  const connect = useCallback(() => {
    if (!socket || !currentVPS) return;

    setConnecting(true);
    setConnected(false);

    const term = initTerminal();
    if (!term) return;

    term.writeln('\x1b[1;34m╔══════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;34m║\x1b[0m    \x1b[1;37mVPS Manager - SSH Terminal\x1b[0m              \x1b[1;34m║\x1b[0m');
    term.writeln('\x1b[1;34m╚══════════════════════════════════════════╝\x1b[0m');
    term.writeln(`\x1b[33mĐang kết nối đến \x1b[1m${currentVPS.host || 'localhost'}\x1b[0m\x1b[33m...\x1b[0m\r\n`);

    socket.emit('terminal:create', currentVPS);

    const onReady = () => {
      setConnected(true);
      setConnecting(false);
      term.reset();
      term.writeln(`\x1b[1;32m✓ Kết nối thành công! (${currentVPS.host || 'localhost'})\x1b[0m\r\n`);
      term.focus();
    };

    const onData = (data) => {
      term.write(data);
    };

    const onError = ({ error }) => {
      setConnected(false);
      setConnecting(false);
      term.writeln(`\r\n\x1b[1;31m✖ Lỗi kết nối: ${error}\x1b[0m`);
      term.writeln(`\x1b[33mBấm nút "Kết nối lại" để thử lại.\x1b[0m\r\n`);
    };

    const onClosed = () => {
      setConnected(false);
      setConnecting(false);
      term.writeln('\r\n\x1b[1;33m⚠ Phiên terminal đã bị ngắt.\x1b[0m');
      term.writeln('\x1b[33mBấm nút "Kết nối lại" để kết nối mới.\x1b[0m\r\n');
    };

    socket.on('terminal:ready', onReady);
    socket.on('terminal:data', onData);
    socket.on('terminal:error', onError);
    socket.on('terminal:closed', onClosed);

    term.onData((data) => {
      socket.emit('terminal:input', data);
    });

    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
        socket.emit('terminal:resize', {
          cols: term.cols,
          rows: term.rows,
        });
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 150);
    setTimeout(handleResize, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('terminal:ready', onReady);
      socket.off('terminal:data', onData);
      socket.off('terminal:error', onError);
      socket.off('terminal:closed', onClosed);
    };
  }, [socket, currentVPS, initTerminal]);

  // Auto connect on mount and when VPS changes
  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [connect]);

  // Reconnect
  const handleReconnect = () => {
    if (socket) socket.emit('terminal:destroy');
    connect();
  };

  // Clear terminal
  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.focus();
    }
  };

  // Copy selection
  const handleCopySelection = () => {
    if (xtermRef.current) {
      const sel = xtermRef.current.getSelection();
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {});
      }
    }
  };

  // Run snippet
  const handleRunSnippet = (cmd) => {
    if (socket && connected) {
      socket.emit('terminal:input', cmd + '\n');
      if (xtermRef.current) xtermRef.current.focus();
    }
  };

  // Add snippet
  const handleAddSnippet = (e) => {
    e.preventDefault();
    if (!newSnippetName.trim() || !newSnippetCmd.trim()) return;
    setCustomSnippets(prev => [...prev, {
      name: newSnippetName.trim(),
      cmd: newSnippetCmd.trim(),
      desc: 'Lệnh cá nhân tự định nghĩa'
    }]);
    setNewSnippetName('');
    setNewSnippetCmd('');
    setShowAddForm(false);
  };

  const handleDeleteSnippet = (idx) => {
    setCustomSnippets(prev => prev.filter((_, i) => i !== idx));
  };

  // Filter snippets
  const filteredSystem = SYSTEM_SNIPPETS.filter(s =>
    s.name.toLowerCase().includes(snippetFilter.toLowerCase()) ||
    s.cmd.toLowerCase().includes(snippetFilter.toLowerCase())
  );
  const filteredCustom = customSnippets.filter(s =>
    s.name.toLowerCase().includes(snippetFilter.toLowerCase()) ||
    s.cmd.toLowerCase().includes(snippetFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TermIcon size={20} className="text-violet-400" />
            SSH Terminal
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Kết nối dòng lệnh trực tiếp đến VPS — Native &amp; SSH Mode
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusDot connected={connected} />

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Actions */}
          <button
            onClick={handleClear}
            title="Xóa màn hình"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Trash size={15} />
          </button>
          <button
            onClick={handleCopySelection}
            title="Copy vùng chọn"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={handleReconnect}
            disabled={connecting}
            title="Kết nối lại"
            className={`p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all ${
              connecting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw size={15} className={connecting ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Ẩn sidebar' : 'Hiện sidebar'}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">

        {/* Terminal pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-xl border border-white/5 bg-[#0d0f14] shadow-2xl">
          {/* Terminal top bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-black/40 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-gray-500 font-mono">
              {currentVPS?.host || 'localhost'} — bash
            </span>
          </div>

          {/* xterm.js container */}
          <div
            ref={terminalRef}
            id="terminal-container"
            className="flex-1 p-1 overflow-hidden"
            style={{ minHeight: 0 }}
          />
        </div>

        {/* Snippet sidebar */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 flex flex-col gap-2 overflow-hidden">
            <div className="card-glass rounded-xl flex flex-col p-3 gap-2 overflow-hidden h-full">
              {/* Sidebar header */}
              <div className="flex items-center justify-between pb-1 border-b border-white/10 shrink-0">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <TermIcon size={13} className="text-violet-400" />
                  Snippet Manager
                </span>
                <button
                  onClick={() => setShowAddForm(v => !v)}
                  className="p-1 rounded text-violet-400 hover:bg-violet-500/10 transition-all"
                  title="Thêm snippet"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Tìm lệnh..."
                value={snippetFilter}
                onChange={e => setSnippetFilter(e.target.value)}
                className="w-full bg-black/30 border border-white/8 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-violet-500 placeholder-gray-600 transition-colors shrink-0"
              />

              {/* Add form */}
              {showAddForm && (
                <form onSubmit={handleAddSnippet} className="p-2.5 bg-violet-500/5 border border-violet-500/20 rounded-lg space-y-2 shrink-0">
                  <input
                    type="text"
                    required
                    placeholder="Tên gợi nhớ (ví dụ: Restart PM2)"
                    value={newSnippetName}
                    onChange={e => setNewSnippetName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-violet-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Lệnh shell (ví dụ: pm2 restart all)"
                    value={newSnippetCmd}
                    onChange={e => setNewSnippetCmd(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-gray-200 outline-none font-mono focus:border-violet-500"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button type="button" onClick={() => setShowAddForm(false)}
                      className="px-2 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 rounded transition-colors">
                      Hủy
                    </button>
                    <button type="submit"
                      className="px-2 py-1 text-[10px] bg-violet-600 hover:bg-violet-700 text-white rounded transition-colors">
                      Lưu
                    </button>
                  </div>
                </form>
              )}

              {/* Snippets list */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 min-h-0" style={{ scrollbarWidth: 'thin' }}>

                {/* Custom snippets */}
                {filteredCustom.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-bold text-violet-400/80 uppercase tracking-wider px-0.5">
                      Lệnh cá nhân ({filteredCustom.length})
                    </h3>
                    {filteredCustom.map((snippet, idx) => (
                      <SnippetRow
                        key={`custom-${idx}`}
                        snippet={snippet}
                        onRun={() => handleRunSnippet(snippet.cmd)}
                        onDelete={() => handleDeleteSnippet(customSnippets.indexOf(snippet))}
                        showDelete
                        connected={connected}
                        accent="violet"
                      />
                    ))}
                  </div>
                )}

                {/* System snippets */}
                <div className="space-y-1">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-0.5">
                    Hệ thống ({filteredSystem.length})
                  </h3>
                  {filteredSystem.map((snippet, idx) => (
                    <SnippetRow
                      key={`sys-${idx}`}
                      snippet={snippet}
                      onRun={() => handleRunSnippet(snippet.cmd)}
                      connected={connected}
                      accent="blue"
                    />
                  ))}
                </div>

                {filteredSystem.length === 0 && filteredCustom.length === 0 && (
                  <p className="text-xs text-gray-600 text-center pt-4">
                    Không tìm thấy snippet nào.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for a single snippet row
function SnippetRow({ snippet, onRun, onDelete, showDelete = false, connected, accent = 'blue' }) {
  const accentClass = accent === 'violet'
    ? 'border-violet-500/15 bg-violet-500/5 hover:bg-violet-500/10'
    : 'border-white/5 bg-white/3 hover:bg-white/8';

  return (
    <div className={`flex items-center justify-between p-2 border ${accentClass} rounded-lg group transition-all`}>
      <div className="overflow-hidden mr-1.5 flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-200 block truncate">{snippet.name}</span>
        <code className="text-[10px] text-gray-500 font-mono block truncate" title={snippet.cmd}>
          {snippet.cmd}
        </code>
      </div>
      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={onRun}
          disabled={!connected}
          className={`p-1.5 rounded transition-colors ${
            connected
              ? 'hover:bg-green-500/20 text-green-400 cursor-pointer'
              : 'text-gray-600 cursor-not-allowed'
          }`}
          title={connected ? 'Chạy lệnh' : 'Chưa kết nối terminal'}
        >
          <Play size={11} />
        </button>
        {showDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
            title="Xóa snippet"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
