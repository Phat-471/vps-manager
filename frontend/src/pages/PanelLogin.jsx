import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, Eye, EyeOff, Server, Cpu, Wifi } from 'lucide-react';

// Animated floating particles
function Particles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.1,
    }));
    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      // Draw connecting lines
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach(q => {
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

// Animated status indicator
function StatusDot({ label, value, color = 'green' }) {
  const colors = {
    green: { dot: '#10b981', glow: 'rgba(16,185,129,0.4)', text: '#6ee7b7' },
    blue: { dot: '#6366f1', glow: 'rgba(99,102,241,0.4)', text: '#a5b4fc' },
    purple: { dot: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', text: '#c4b5fd' },
  };
  const c = colors[color];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: c.dot, boxShadow: `0 0 6px ${c.glow}`,
        animation: 'pulse-dot 2s ease-in-out infinite'
      }} />
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}:</span>
      <span style={{ fontSize: 11, color: c.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function PanelLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
    const params = new URLSearchParams(window.location.search);
    const pwdParam = params.get('password');
    if (pwdParam) {
      setPassword(pwdParam);
      const autoLogin = async () => {
        setLoading(true);
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwdParam }),
          });
          const result = await response.json();
          if (response.ok && result.success) {
            window.history.replaceState({}, document.title, window.location.pathname);
            onLogin(result.token);
          } else {
            setError(result.error || 'Mật khẩu từ liên kết không chính xác');
          }
        } catch {
          setError('Không thể kết nối đến máy chủ.');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        onLogin(result.token);
      } else {
        setError(result.error || 'Mật khẩu không chính xác');
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #020408 0%, #070913 40%, #0a0818 70%, #050310 100%)',
      fontFamily: "'Outfit', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background */}
      <Particles />

      {/* Radial glow orbs */}
      <div style={{
        position: 'absolute', top: '15%', left: '20%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '15%',
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 800, height: 800,
        background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 60%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0
      }} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* Top status bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(7,9,19,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(99,102,241,0.08)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(99,102,241,0.4)'
          }}>
            <Shield size={14} color="white" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>
            VPS Manager <span style={{ color: '#8b5cf6' }}>Ultimate</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <StatusDot label="System" value="Online" color="green" />
          <StatusDot label="Security" value="Active" color="blue" />
          <StatusDot label="Encryption" value="AES-256" color="purple" />
        </div>
      </div>

      {/* Main card */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 460,
        padding: '0 20px',
        boxSizing: 'border-box',
        margin: '0 auto',
        transform: mounted ? 'translateY(0)' : 'translateY(30px)',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        animation: shake ? 'shake 0.5s ease-in-out' : 'none',
      }}>
        {/* Outer glow border */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2), rgba(99,102,241,0.1))',
          borderRadius: 28, padding: 1.5,
          boxShadow: '0 0 60px rgba(99,102,241,0.15), 0 0 120px rgba(139,92,246,0.08)',
        }}>
          <div style={{
            background: 'rgba(8,10,22,0.92)',
            borderRadius: 27,
            padding: '40px 40px 36px',
            backdropFilter: 'blur(30px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Inner top shine */}
            <div style={{
              position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
              borderRadius: 1,
            }} />

            {/* Logo Section */}
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              {/* Animated shield icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 24,
                  background: 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15), transparent 60%)',
                }} />
                <Shield size={36} color="#818cf8" strokeWidth={1.5} />
              </div>

              <h1 style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #e2e8f0, #a5b4fc)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                marginBottom: 8, lineHeight: 1.2
              }}>
                VPS Manager Ultimate
              </h1>
              <p style={{ fontSize: 13, color: '#475569', fontWeight: 400, letterSpacing: '0.01em' }}>
                Hệ thống quản trị máy chủ bảo mật nâng cao
              </p>

              {/* Divider */}
              <div style={{
                margin: '20px auto 0',
                width: 60, height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)',
                borderRadius: 1
              }} />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Label */}
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.1em'
                }}>
                  Mật khẩu truy cập Panel
                </label>
                <span style={{
                  fontSize: 10, color: '#4338ca',
                  background: 'rgba(99,102,241,0.1)', padding: '2px 8px',
                  borderRadius: 20, fontWeight: 600, letterSpacing: '0.05em'
                }}>
                  PROTECTED
                </span>
              </div>

              {/* Password input */}
              <div style={{
                position: 'relative',
                marginBottom: error ? 12 : 20,
                borderRadius: 14,
                background: focused ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)',
                border: focused
                  ? '1px solid rgba(99,102,241,0.5)'
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: focused
                  ? '0 0 0 3px rgba(99,102,241,0.1), 0 0 20px rgba(99,102,241,0.08)'
                  : '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: focused ? '#818cf8' : '#475569',
                  transition: 'color 0.3s',
                  display: 'flex', alignItems: 'center'
                }}>
                  <Lock size={16} />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Nhập mật khẩu bảo vệ..."
                  disabled={loading}
                  autoFocus
                  style={{
                    width: '100%', padding: '14px 48px 14px 42px',
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#e2e8f0', fontSize: 14, fontFamily: "'Outfit', sans-serif",
                    letterSpacing: password && !showPw ? '0.3em' : '0',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#475569', padding: 4,
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
                  onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 12, padding: '10px 14px',
                  marginBottom: 16,
                  animation: 'fadeIn 0.3s ease',
                }}>
                  <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#f87171', fontWeight: 500, lineHeight: 1.5 }}>
                    {error}
                  </span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !password.trim()}
                style={{
                  width: '100%', padding: '15px 24px',
                  borderRadius: 14, border: 'none', cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
                  background: loading || !password.trim()
                    ? 'rgba(99,102,241,0.3)'
                    : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                  color: 'white', fontSize: 14, fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.03em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: loading || !password.trim()
                    ? 'none'
                    : '0 4px 24px rgba(99,102,241,0.4), 0 0 0 1px rgba(139,92,246,0.3)',
                  transition: 'all 0.25s ease',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (!loading && password.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.5), 0 0 0 1px rgba(139,92,246,0.4)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = loading || !password.trim()
                    ? 'none'
                    : '0 4px 24px rgba(99,102,241,0.4), 0 0 0 1px rgba(139,92,246,0.3)';
                }}
              >
                {/* Button shine effect */}
                <div style={{
                  position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                  animation: !loading && password.trim() ? 'btn-shine 3s ease-in-out infinite' : 'none',
                }} />
                {loading ? (
                  <>
                    <div style={{
                      width: 18, height: 18,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <>
                    <span>Mở khóa bảng điều khiển</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={12} color="#334155" />
                <span style={{ fontSize: 11, color: '#334155' }}>
                  Cấu hình trong file <code style={{
                    background: 'rgba(255,255,255,0.05)', padding: '1px 5px',
                    borderRadius: 4, color: '#475569', fontSize: 10
                  }}>.env</code>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Wifi size={11} color="#1e3a5f" />
                <span style={{ fontSize: 10, color: '#1e3a5f', fontWeight: 600 }}>SSL SECURED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%,100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes btn-shine {
          0% { left: -100%; }
          30%, 100% { left: 200%; }
        }
        input::placeholder { color: #334155; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px rgba(8,10,22,0.92) inset;
          -webkit-text-fill-color: #e2e8f0;
        }
      `}</style>
    </div>
  );
}
