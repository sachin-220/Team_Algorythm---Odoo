import React from 'react';
import { Search, UserCheck, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = ({ title, search, setSearch, onProfileClick }) => {
  const { user } = useAuth();

  return (
    <header style={{
      height: '64px',
      background: 'rgba(30, 41, 59, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Title */}
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
        {title}
      </h1>

      {/* Global Search & Profile Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {setSearch && (
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, SKUs, documents..."
              className="form-control"
              style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.85rem' }}
            />
          </div>
        )}

        {/* Role Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '9999px',
          background: 'rgba(59, 130, 246, 0.15)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          color: '#60a5fa',
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          <Shield size={14} />
          <span>{user?.role || 'Staff'}</span>
        </div>

        {/* Profile Button */}
        <button
          onClick={onProfileClick}
          style={{
            background: 'none',
            border: 'none',
            color: '#f8fafc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            transition: 'background 0.2s ease'
          }}
          className="btn-secondary"
        >
          <UserCheck size={18} color="#38bdf8" />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Profile</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
