import React from 'react';

export default function Topbar({ title, children }) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div className="topbar-actions">
        {children}
      </div>
    </div>
  );
}
