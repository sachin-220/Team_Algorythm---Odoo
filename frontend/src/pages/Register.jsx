import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { User, Mail, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import loginBg from '../assets/login-bg.avif';

const Register = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const { showSuccess, showError } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('Warehouse Staff');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Calculate password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, text: '', color: 'rgba(255,255,255,0.2)' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, text: 'Weak', color: '#EF4444' };
    if (score <= 4) return { score: 2, text: 'Medium', color: '#F59E0B' };
    return { score: 3, text: 'Strong', color: '#10B981' };
  };

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password, role);
      showSuccess('Account registered successfully! You can now log in.');
      onSwitchToLogin();
    } catch (err) {
      showError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `url(${loginBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      padding: '1.5rem',
      fontFamily: 'var(--font-ui)',
      boxSizing: 'border-box',
      position: 'relative'
    }}>
      {/* Subtle vignette layer to enhance depth without flattening the 3D graphics */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(6, 18, 24, 0.15) 0%, rgba(4, 12, 16, 0.65) 100%)',
        pointerEvents: 'none'
      }} />

      {/* Seamless Deep-Glass Fused Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '430px',
        backgroundColor: 'rgba(7, 20, 26, 0.68)',
        backdropFilter: 'blur(28px) saturate(210%)',
        WebkitBackdropFilter: 'blur(28px) saturate(210%)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderTop: '1px solid rgba(255, 255, 255, 0.28)',
        borderRadius: '24px',
        padding: '2.6rem 2.25rem',
        boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(14, 165, 233, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        boxSizing: 'border-box',
        color: '#FFFFFF'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#F4D21F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 0 20px rgba(244, 210, 31, 0.45), 0 4px 10px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '3px',
              backgroundColor: '#181818',
              transform: 'rotate(45deg)'
            }} />
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.65)',
            marginBottom: '0.4rem'
          }}>
            StockSense
          </div>

          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '2.25rem', 
            fontWeight: 400, 
            color: '#FFFFFF', 
            margin: '0 0 0.35rem', 
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
          }}>
            Create your account
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: '1.15rem' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
              Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter full name or username"
                style={{ 
                  width: '100%', 
                  height: '44px', 
                  paddingLeft: '2.5rem',
                  paddingRight: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  outline: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  backdropFilter: 'blur(10px)',
                  fontFamily: 'var(--font-ui)',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F4D21F';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(244, 210, 31, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '1.15rem' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@example.com"
                style={{ 
                  width: '100%', 
                  height: '44px', 
                  paddingLeft: '2.5rem',
                  paddingRight: '0.85rem',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  outline: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  backdropFilter: 'blur(10px)',
                  fontFamily: 'var(--font-ui)',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F4D21F';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(244, 210, 31, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1.15rem' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                style={{ 
                  width: '100%', 
                  height: '44px', 
                  paddingLeft: '2.5rem',
                  paddingRight: '2.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  outline: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  backdropFilter: 'blur(10px)',
                  fontFamily: 'var(--font-ui)',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#F4D21F';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(244, 210, 31, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.6)' }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div style={{ marginTop: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Strength:</span>
                  <span style={{ fontWeight: 600, color: pwdStrength.color }}>{pwdStrength.text}</span>
                </div>
                <div style={{ height: '3px', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(pwdStrength.score / 3) * 100}%`,
                    backgroundColor: pwdStrength.color,
                    transition: 'all 0.2s ease'
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={{ 
                  width: '100%', 
                  height: '44px', 
                  paddingLeft: '2.5rem',
                  paddingRight: '2.5rem',
                  border: confirmPassword ? (passwordsMatch ? '1px solid #10B981' : '1px solid #EF4444') : '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  outline: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  backdropFilter: 'blur(10px)',
                  fontFamily: 'var(--font-ui)',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.6)' }}
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPassword && (
              <div style={{ fontSize: '11px', marginTop: '0.35rem', color: passwordsMatch ? '#10B981' : '#EF4444', fontWeight: 500 }}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading || (confirmPassword && !passwordsMatch)} 
            style={{ 
              width: '100%', 
              height: '44px', 
              marginTop: '0.5rem', 
              backgroundColor: '#F4D21F',
              color: '#121212',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: (loading || (confirmPassword && !passwordsMatch)) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: (confirmPassword && !passwordsMatch) ? 0.6 : 1,
              boxShadow: '0 4px 20px rgba(244, 210, 31, 0.35)'
            }}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{ background: 'none', border: 'none', color: '#F4D21F', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
