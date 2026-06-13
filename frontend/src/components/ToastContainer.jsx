import React from 'react';
import { useVPS } from '../context/VPSContext';

export default function ToastContainer() {
  const { toasts } = useVPS();

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && '✅ '}
          {t.type === 'error' && '❌ '}
          {t.type === 'warning' && '⚠️ '}
          {t.type === 'info' && 'ℹ️ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}
