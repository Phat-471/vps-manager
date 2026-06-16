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
  const [encryptionKey, setEncryptionKey] = useState('');

  // Helper password methods
  const decryptPassword = (encrypted, customKey) => {
    const key = customKey || encryptionKey || 'vps-manager-secret';
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, key);
      const dec = bytes.toString(CryptoJS.enc.Utf8);
      if (dec) return dec;
      
      // Fallback nếu dùng key động lỗi, thử key cũ
      if (key !== 'vps-manager-secret') {
        const fallbackBytes = CryptoJS.AES.decrypt(encrypted, 'vps-manager-secret');
        return fallbackBytes.toString(CryptoJS.enc.Utf8) || encrypted;
      }
      return encrypted;
    } catch {
      // Fallback
      if (key !== 'vps-manager-secret') {
        try {
          const fallbackBytes = CryptoJS.AES.decrypt(encrypted, 'vps-manager-secret');
          return fallbackBytes.toString(CryptoJS.enc.Utf8) || encrypted;
        } catch {
          return encrypted;
        }
      }
      return encrypted;
    }
  };

  const encryptPassword = (password, customKey) => {
    const key = customKey || encryptionKey || 'vps-manager-secret';
    return CryptoJS.AES.encrypt(password, key).toString();
  };

  const fetchEncryptionKey = async (token) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const currentToken = token || localStorage.getItem('panelToken');
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }
      const response = await fetch('/api/auth/encryption-key', {
        method: 'POST',
        headers
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.key) {
          setEncryptionKey(result.key);
          return result.key;
        }
      }
    } catch (err) {
      console.error('Lỗi lấy khóa mã hóa từ server:', err);
    }
    return '';
  };

  const reloadVPSList = (key) => {
    const saved = localStorage.getItem('vpsList');
    let list = saved ? JSON.parse(saved) : [];
    
    // Tự động thêm Local VPS (Native Mode) nếu danh sách trống để vào thẳng dashboard
    if (list.length === 0) {
      const keyToUse = key || encryptionKey || 'vps-manager-secret';
      const localPwd = CryptoJS.AES.encrypt('local-dummy-password', keyToUse).toString();
      const defaultLocal = {
        id: 'vps_local',
        name: 'Local VPS (Native)',
        host: 'localhost',
        port: 22,
        username: 'root',
        password: localPwd
      };
      list = [defaultLocal];
      localStorage.setItem('vpsList', JSON.stringify(list));
    }
    
    let listChanged = false;
    const migratedList = list.map(vps => {
      try {
        let decrypted = '';
        let isOldKey = false;
        
        if (key && key !== 'vps-manager-secret') {
          try {
            const bytes = CryptoJS.AES.decrypt(vps.password, key);
            decrypted = bytes.toString(CryptoJS.enc.Utf8);
          } catch (e) {
            decrypted = '';
          }
        }
        
        if (!decrypted) {
          try {
            const bytes = CryptoJS.AES.decrypt(vps.password, 'vps-manager-secret');
            decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (decrypted) {
              isOldKey = true;
            }
          } catch (e) {
            decrypted = '';
          }
        }
        
        if (decrypted && isOldKey && key) {
          vps.password = CryptoJS.AES.encrypt(decrypted, key).toString();
          listChanged = true;
        }
      } catch (err) {
        console.error('Lỗi di trú mật khẩu VPS:', err);
      }
      return vps;
    });

    if (listChanged) {
      localStorage.setItem('vpsList', JSON.stringify(migratedList));
    }
    setVpsList(migratedList);

    const lastVPSId = localStorage.getItem('lastVPSId');
    if (migratedList.length > 0) {
      const savedVPS = migratedList.find(v => v.id === lastVPSId) || migratedList[0];
      const decryptedPass = decryptPassword(savedVPS.password, key);
      connectToVPS({ ...savedVPS, password: decryptedPass });
    } else {
      setActivePage('vps-modal'); // Force connection screen
    }
  };

  // Check panel authentication and load saved VPS on mount
  useEffect(() => {
    const checkPanelAuthAndLoad = async () => {
      let isProtected = false;
      let isAuthenticated = true;
      const token = localStorage.getItem('panelToken');

      // 1. Check Panel Protection Status
      try {
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
            isProtected = result.required;
            isAuthenticated = result.authenticated;
            setIsPanelProtected(isProtected);
            setIsPanelAuthenticated(isAuthenticated);
            if (!isAuthenticated && token) {
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

      // 2. Fetch Encryption Key
      let key = '';
      if (isAuthenticated || !isProtected) {
        key = await fetchEncryptionKey(isAuthenticated ? token : null);
      }

      // 3. Load list and reconnect
      reloadVPSList(key);
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
  const loginPanel = async (token) => {
    localStorage.setItem('panelToken', token);
    setPanelToken(token);
    setIsPanelAuthenticated(true);
    showToast('Đăng nhập thành công', 'success');
    
    const key = await fetchEncryptionKey(token);
    reloadVPSList(key);
  };

  const logoutPanel = () => {
    localStorage.removeItem('panelToken');
    setPanelToken('');
    setIsPanelAuthenticated(false);
    setEncryptionKey('');
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
        
        const key = await fetchEncryptionKey(result.token);
        reloadVPSList(key);
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
