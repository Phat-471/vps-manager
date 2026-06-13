import React, { useEffect, useRef } from 'react';
import { useVPS } from '../context/VPSContext';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export default function Terminal() {
  const { socket, currentVPS } = useVPS();
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

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

    term.writeln('正在建立 SSH Terminal 终端连接...');

    // Emit event to create terminal process on server
    socket.emit('terminal:create', currentVPS);

    // Event listeners
    socket.on('terminal:ready', () => {
      term.reset();
      term.writeln('\x1b[1;32m✓ SSH Terminal 连接已建立! (IP: ' + currentVPS.host + ')\x1b[0m\r\n');
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

    // Handle resizing window
    const handleResize = () => {
      try {
        fitAddon.fit();
        socket.emit('terminal:resize', {
          cols: term.cols,
          rows: term.rows,
        });
      } catch (e) {
        console.error(e);
      }
    };

    window.addEventListener('resize', handleResize);

    // Delay resize request slightly after mount
    setTimeout(handleResize, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('terminal:ready');
      socket.off('terminal:data');
      socket.off('terminal:error');
      socket.off('terminal:closed');
      term.dispose();
    };
  }, [socket, currentVPS]);

  return (
    <div className="space-y-4 h-[calc(100vh-160px)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SSH Terminal</h1>
        <p className="text-sm text-gray-400">Thiết lập kết nối dòng lệnh trực tiếp (SSH Shell) tới VPS</p>
      </div>

      <div className="flex-1 card-glass p-3 rounded-xl overflow-hidden min-h-[400px] flex">
        <div
          ref={terminalRef}
          className="w-full h-full rounded-lg overflow-hidden"
        />
      </div>
    </div>
  );
}
