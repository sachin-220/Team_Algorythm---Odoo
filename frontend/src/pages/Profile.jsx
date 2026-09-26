import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserCheck, Shield, Key } from 'lucide-react';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(email, password || undefined);
      showSuccess('Profile updated successfully!');
      setPassword('');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Breadcrumb Trail */}
      <div className="breadcrumb-trail">
        <span>StockSense</span>
        <span>/</span>
        <span>Account</span>
        <span>/</span>
        <span className="active">Profile</span>
      </div>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="display-title">User Profile</h1>
        <p className="display-subtitle" style={{ marginBottom: 0 }}>
          Manage your account credentials, security preferences, and system privileges.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '2rem' }}>
        {/* User Card */}
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--accent-yellow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: '#202020',
            border: '2px solid rgba(32,32,32,0.1)'
          }}>
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{user?.username}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{user?.email}</p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600
          }}>
            <Shield size={14} />
            <span>Role: {user?.role}</span>
          </div>
        </div>

        {/* Update Form */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={20} color="#38bdf8" />
            <span>Update Account Credentials</span>
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username (Read Only)</label>
              <input type="text" disabled value={user?.username || ''} className="form-control" style={{ opacity: 0.7 }} />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password (Leave blank to keep unchanged)</label>
              <input
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="form-control"
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              {loading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
