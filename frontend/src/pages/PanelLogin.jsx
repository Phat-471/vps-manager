import React, { useState, useEffect } from 'react';
import { Shield, KeyRound, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export default function PanelLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pwdParam = params.get('password');
    if (pwdParam) {
      setPassword(pwdParam);
      const autoLogin = async () => {
        setLoading(true);
        setError('');
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: pwdParam }),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            // Xóa query parameter khỏi URL để tránh lưu lịch sử duyệt web
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            onLogin(result.token);
          } else {
            setError(result.error || 'Mật khẩu từ liên kết không chính xác');
          }
        } catch (err) {
          console.error(err);
          setError('Không thể kết nối tự động đến máy chủ. Vui lòng thử lại.');
        } finally {
          setLoading(false);
        }
      };
      autoLogin();
    }
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        onLogin(result.token);
      } else {
        setError(result.error || 'Mật khẩu không chính xác');
      }
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070913] p-4 relative overflow-hidden font-outfit">
      {/* Background radial glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main glass card container */}
      <div className="w-full max-w-[420px] double-bezel-outer relative z-10" style={{ padding: '6px', borderRadius: '24px' }}>
        <div className="double-bezel-inner" style={{ padding: '32px', borderRadius: '18px', background: 'rgba(10, 10, 26, 0.65)' }}>
          {/* Header Icon & Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              VPS Manager Ultimate
            </h1>
            <p className="text-sm text-gray-400">
              Hệ thống quản trị máy chủ bảo mật
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-2">
                Mật khẩu truy cập Panel
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="input-glass pl-10 w-full"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs text-red-400 font-medium animate-pulse">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="btn btn-primary btn-block py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Mở khóa bảng điều khiển
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer info */}
          <div className="mt-8 text-center text-xs text-gray-500">
            Thiết lập cấu hình trong file <code className="bg-white/5 px-1 py-0.5 rounded text-gray-400">.env</code> trên VPS
          </div>
        </div>
      </div>
    </div>
  );
}
