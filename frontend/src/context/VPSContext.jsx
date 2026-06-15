import React, { createContext, useState, useEffect, useContext } from 'react';
import io from 'socket.io-client';
import CryptoJS from 'crypto-js';

const VPSContext = createContext(null);

export const VPSProvider = ({ children }) => {
  const [currentVPS, setCurrentVPS] = useState(null);
  const [vpsList, setVpsList] = useState([]);
  const [socket, setSocket] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Authentication States
  const [panelToken, setPanelToken] = useState(localStorage.getItem('panelToken') || '');
  const [isPanelProtected, setIsPanelProtected] = useState(false);
  const [isPanelAuthenticated, setIsPanelAuthenticated] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Helper password methods
  const decryptPassword = (encrypted) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, 'vps-manager-secret');
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return encrypted;
    }
  };

  const encryptPassword = (password) => {
    return CryptoJS.AES.encrypt(password, 'vps-manager-secret').toString();
  };

  // Check panel authentication and load saved VPS on mount
  useEffect(() => {
    const checkPanelAuthAndLoad = async () => {
      // 1. Check Panel Protection Status
      try {
        const token = localStorage.getItem('panelToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch('/api/auth/status', {
          method: 'POST',
          headers
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setIsPanelProtected(result.required);
            setIsPanelAuthenticated(result.authenticated);
            if (!result.authenticated && token) {
              localStorage.removeItem('panelToken');
              setPanelToken('');
            }
          }
        }
      } catch (err) {
        console.error('Lỗi kiểm tra bảo mật panel:', err);
      } finally {
        setAuthChecked(true);
      }

      // 2. Load saved VPS list
      const saved = localStorage.getItem('vpsList');
      const list = saved ? JSON.parse(saved) : [];
      setVpsList(list);

      const lastVPSId = localStorage.getItem('lastVPSId');
      if (list.length > 0) {
        const savedVPS = list.find(v => v.id === lastVPSId) || list[0];
        // Decrypt password
        const decryptedPass = decryptPassword(savedVPS.password);
        connectToVPS({ ...savedVPS, password: decryptedPass });
      } else {
        setActivePage('vps-modal'); // Force connection screen
      }
    };

    checkPanelAuthAndLoad();
  }, []);

  // Socket management
  useEffect(() => {
    if (!currentVPS) return;

    const token = localStorage.getItem('panelToken');
    const newSocket = io({
      auth: {
        token: token || ''
      }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      showToast('Kết nối WebSocket thành công', 'success');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      showToast('Mất kết nối WebSocket', 'error');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [currentVPS]);

  const connectToVPS = (vps) => {
    setCurrentVPS(vps);
    localStorage.setItem('lastVPSId', vps.id);
    setActivePage('dashboard');
  };

  const disconnectVPS = () => {
    localStorage.removeItem('lastVPSId');
    setCurrentVPS(null);
    setIsConnected(false);
    if (socket) socket.disconnect();
    setSocket(null);
    setActivePage('vps-modal');
  };

  const saveVPS = (newVps) => {
    const list = [...vpsList];
    const encryptedVps = {
      ...newVps,
      id: newVps.id || 'vps_' + Date.now(),
      password: encryptPassword(newVps.password)
    };

    const index = list.findIndex(v => v.host === newVps.host);
    if (index >= 0) {
      list[index] = encryptedVps;
    } else {
      list.push(encryptedVps);
    }

    setVpsList(list);
    localStorage.setItem('vpsList', JSON.stringify(list));
    
    // Connect immediately
    connectToVPS({ ...newVps, id: encryptedVps.id });
    showToast('Đã lưu VPS thành công', 'success');
  };

  const deleteVPS = (id) => {
    const list = vpsList.filter(v => v.id !== id);
    setVpsList(list);
    localStorage.setItem('vpsList', JSON.stringify(list));
    showToast('Đã xóa VPS', 'success');
    if (currentVPS?.id === id) {
      disconnectVPS();
    }
  };

  // Toast System
  const showToast = (message, type = 'info') => {
    const toastId = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id: toastId, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 3500);
  };

  // Panel login/logout actions
  const loginPanel = (token) => {
    localStorage.setItem('panelToken', token);
    setPanelToken(token);
    setIsPanelAuthenticated(true);
    showToast('Đăng nhập thành công', 'success');
  };

  const logoutPanel = () => {
    localStorage.removeItem('panelToken');
    setPanelToken('');
    setIsPanelAuthenticated(false);
    showToast('Đã đăng xuất khỏi Panel', 'info');
  };

  const setupPanel = async (password) => {
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        localStorage.setItem('panelToken', result.token);
        setPanelToken(result.token);
        setIsPanelProtected(true);
        setIsPanelAuthenticated(true);
        showToast('Thiết lập mật khẩu bảo mật Panel thành công', 'success');
        return { success: true };
      } else {
        throw new Error(result.error || 'Thiết lập mật khẩu thất bại');
      }
    } catch (err) {
      showToast(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  // REST API Wrapper
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    const token = localStorage.getItem('panelToken');
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (method !== 'GET') {
      // Always attach VPS credentials on non-GET calls
      options.body = JSON.stringify({
        vpsConfig: currentVPS,
        ...(data || {})
      });
    }

    try {
      const response = await fetch(endpoint, options);

      if (response.status === 401) {
        localStorage.removeItem('panelToken');
        setPanelToken('');
        setIsPanelAuthenticated(false);
        showToast('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        throw new Error('Unauthorized');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Yêu cầu thất bại');
      }

      return result;
    } catch (err) {
      console.error('API Error:', err);
      if (err.message !== 'Unauthorized') {
        showToast(err.message, 'error');
      }
      throw err;
    }
  };

  return (
    <VPSContext.Provider value={{
      currentVPS,
      vpsList,
      socket,
      activePage,
      setActivePage,
      toasts,
      isConnected,
      connectToVPS,
      disconnectVPS,
      saveVPS,
      deleteVPS,
      showToast,
      apiCall,
      panelToken,
      isPanelProtected,
      isPanelAuthenticated,
      authChecked,
      loginPanel,
      logoutPanel,
      setupPanel
    }}>
      {children}
    </VPSContext.Provider>
  );
};

export const useVPS = () => {
  const context = useContext(VPSContext);
  if (!context) throw new Error('useVPS must be used within VPSProvider');
  return context;
};
