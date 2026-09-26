import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Lock, User, Mail, ArrowLeft, RefreshCw, 
  CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Timer
} from 'lucide-react';
import apiClient from '../api/client';
import loginBg from '../assets/login-bg.avif';

const Login = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const { showSuccess, showError } = useToast();

  // Mode: 'login' | 'reset'
  const [isResetMode, setIsResetMode] = useState(false);
  
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // 3-Step Password Reset state: 1 = Email, 2 = Verify OTP, 3 = New Password, 4 = Success
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  // OTP Timers & Error states
  const [resendCooldown, setResendCooldown] = useState(0); // 60s cooldown
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(600); // 10 minutes (600s)
  const [otpError, setOtpError] = useState('');

  const otpInputsRef = useRef([]);

  // 60-second Resend Cooldown Timer
  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // 10-Minute Expiry Countdown Timer
  useEffect(() => {
    let interval = null;
    if (resetStep === 2 && otpExpirySeconds > 0) {
      interval = setInterval(() => {
        setOtpExpirySeconds((prev) => {
          if (prev <= 1) {
            setOtpError('Verification code has expired. Please request a new code.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resetStep, otpExpirySeconds]);

  // Auto focus first OTP input when reaching step 2
  useEffect(() => {
    if (resetStep === 2 && otpInputsRef.current[0]) {
      otpInputsRef.current[0].focus();
    }
  }, [resetStep]);

  // Standard Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      await login(username, password);
      showSuccess('Successfully authenticated! Welcome to StockSense.');
    } catch (err) {
      showError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // STEP 1: Request Password Reset OTP via Gmail SMTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!resetEmail.trim()) {
      showError('Please enter your registered email address.');
      return;
    }
    setResetLoading(true);
    setOtpError('');
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: resetEmail.trim() });
      showSuccess('Verification code sent! Please check your Gmail inbox.');
      setResetStep(2);
      setResendCooldown(res.data.cooldown_seconds || 60);
      setOtpExpirySeconds(600);
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err) {
      const detail = err.response?.data?.detail;
      showError(detail || 'Unable to send verification code. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);
    setOtpError('');

    if (cleanVal && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation in OTP boxes
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Handle pasting full 6-digit OTP code
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData) {
      const newDigits = ['', '', '', '', '', ''];
      for (let i = 0; i < pasteData.length; i++) {
        newDigits[i] = pasteData[i];
      }
      setOtpDigits(newDigits);
      if (pasteData.length === 6) {
        otpInputsRef.current[5]?.focus();
      } else {
        otpInputsRef.current[pasteData.length]?.focus();
      }
    }
  };

  // STEP 2: Verify 6-digit OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }
    if (otpExpirySeconds <= 0) {
      setOtpError('Verification code has expired. Please request a new code.');
      return;
    }

    setResetLoading(true);
    setOtpError('');
    try {
      const res = await apiClient.post('/auth/verify-otp', {
        email: resetEmail.trim(),
        otp_code: otpCode
      });
      showSuccess('Code verified successfully!');
      setResetToken(res.data.reset_token);
      setResetStep(3);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid verification code.';
      setOtpError(detail);
      showError(detail);
    } finally {
      setResetLoading(false);
    }
  };

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

  const pwdStrength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  // STEP 3: Submit New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Passwords do not match. Please verify.');
      return;
    }

    setResetLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email: resetEmail.trim(),
        new_password: newPassword,
        reset_token: resetToken,
        otp_code: otpDigits.join('')
      });
      showSuccess('Password reset successfully!');
      setResetStep(4);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Format seconds to MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReturnToLogin = () => {
    setIsResetMode(false);
    setResetStep(1);
    setResetEmail('');
    setOtpDigits(['', '', '', '', '', '']);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpError('');
  };

  const fillQuickCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
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
            {!isResetMode 
              ? 'Welcome back' 
              : resetStep === 1 
                ? 'Reset your password'
                : resetStep === 2 
                  ? 'Enter verification code'
                  : resetStep === 3 
                    ? 'Create new password'
                    : 'Password Reset'}
          </h1>
        </div>

        {/* ========================================================================= */}
        {/* LOGIN FORM */}
        {/* ========================================================================= */}
        {!isResetMode ? (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter email or username"
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
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

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', margin: 0 }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setIsResetMode(true); setResetStep(1); }}
                  style={{ background: 'none', border: 'none', color: '#F4D21F', fontSize: '12px', cursor: 'pointer', textDecoration: 'none', opacity: 0.9 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
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
            </div>

            {/* High-Contrast Golden Button */}
            <button 
              type="submit" 
              disabled={loginLoading} 
              style={{ 
                width: '100%', 
                height: '44px', 
                marginTop: '0.65rem', 
                backgroundColor: '#F4D21F',
                color: '#121212',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 20px rgba(244, 210, 31, 0.35)'
              }}
            >
              {loginLoading ? 'Signing In...' : 'Sign In'}
            </button>

            {/* Quick Demo Access Pills */}
            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', display: 'block', marginBottom: '0.65rem', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Quick Demo Access:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => fillQuickCredentials('admin', 'password123')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '12px',
                    color: '#E2E8F0',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickCredentials('manager', 'password123')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '12px',
                    color: '#E2E8F0',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickCredentials('staff', 'password123')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '12px',
                    color: '#E2E8F0',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                >
                  Staff
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                style={{ background: 'none', border: 'none', color: '#F4D21F', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Create account
              </button>
            </div>
          </form>
        ) : (
          /* ========================================================================= */
          /* FORGOT PASSWORD / OTP / RESET FLOW */
          /* ========================================================================= */
          <div>
            {/* STEP 1: Enter Email */}
            {resetStep === 1 && (
              <form onSubmit={handleRequestOtp}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
                    Enter your email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
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

                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    width: '100%',
                    height: '44px',
                    backgroundColor: '#F4D21F',
                    color: '#121212',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 20px rgba(244, 210, 31, 0.35)'
                  }}
                >
                  {resetLoading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            )}

            {/* STEP 2: Enter verification code (OTP) */}
            {resetStep === 2 && (
              <form onSubmit={handleVerifyOtp}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)' }}>
                    Code sent to <strong style={{ color: '#FFFFFF' }}>{resetEmail}</strong>
                  </div>
                </div>

                {/* 6 OTP Boxes */}
                <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center', marginBottom: '1rem' }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      style={{
                        width: '44px',
                        height: '52px',
                        textAlign: 'center',
                        fontSize: '22px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        border: digit ? '2px solid #F4D21F' : '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: '#FFFFFF',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  ))}
                </div>

                {/* Error Banner */}
                {otpError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '9px',
                    color: '#FCA5A5',
                    fontSize: '12px',
                    marginBottom: '1rem'
                  }}>
                    <AlertCircle size={15} />
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Expiry & Resend OTP */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '1.25rem',
                  padding: '0 0.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: otpExpirySeconds < 60 ? '#FCA5A5' : 'rgba(255, 255, 255, 0.75)' }}>
                    <Timer size={14} />
                    <span>Expires: <strong style={{ color: '#FFFFFF' }}>{formatTimer(otpExpirySeconds)}</strong></span>
                  </div>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || resetLoading}
                    onClick={handleRequestOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendCooldown > 0 ? 'rgba(255, 255, 255, 0.4)' : '#F4D21F',
                      fontWeight: 600,
                      cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      textDecoration: resendCooldown > 0 ? 'none' : 'underline'
                    }}
                  >
                    <RefreshCw size={12} className={resetLoading ? 'spin' : ''} />
                    <span>{resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading || otpDigits.join('').length !== 6 || otpExpirySeconds <= 0}
                  style={{
                    width: '100%',
                    height: '44px',
                    backgroundColor: '#F4D21F',
                    color: '#121212',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: (resetLoading || otpDigits.join('').length !== 6) ? 'not-allowed' : 'pointer',
                    opacity: (otpDigits.join('').length === 6 && otpExpirySeconds > 0) ? 1 : 0.6,
                    boxShadow: '0 4px 20px rgba(244, 210, 31, 0.35)'
                  }}
                >
                  {resetLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            )}

            {/* STEP 3: Reset password */}
            {resetStep === 3 && (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
                    New password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.6)' }}
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Strength:</span>
                        <span style={{ fontWeight: 600, color: pwdStrength.color }}>{pwdStrength.text}</span>
                      </div>
                      <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: '2px', overflow: 'hidden' }}>
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

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.45rem' }}>
                    Confirm password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <ShieldCheck size={16} color="rgba(255, 255, 255, 0.5)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
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
                  disabled={resetLoading || !passwordsMatch || newPassword.length < 6}
                  style={{
                    width: '100%',
                    height: '44px',
                    backgroundColor: '#F4D21F',
                    color: '#121212',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: (resetLoading || !passwordsMatch || newPassword.length < 6) ? 'not-allowed' : 'pointer',
                    opacity: (passwordsMatch && newPassword.length >= 6) ? 1 : 0.6,
                    boxShadow: '0 4px 20px rgba(244, 210, 31, 0.35)'
                  }}
                >
                  {resetLoading ? 'Resetting password...' : 'Reset password'}
                </button>
              </form>
            )}

            {/* STEP 4: Success State */}
            {resetStep === 4 && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(16, 185, 129, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}>
                  <CheckCircle2 size={32} color="#10B981" />
                </div>
                <p style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                  Your password has been successfully updated. You can now sign in with your new credentials.
                </p>

                <button
                  type="button"
                  onClick={handleReturnToLogin}
                  style={{
                    width: '100%',
                    height: '44px',
                    backgroundColor: '#F4D21F',
                    color: '#121212',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(244, 210, 31, 0.35)'
                  }}
                >
                  Sign In
                </button>
              </div>
            )}

            {resetStep !== 4 && (
              <button
                type="button"
                onClick={handleReturnToLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  margin: '1.5rem auto 0',
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to sign in</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
