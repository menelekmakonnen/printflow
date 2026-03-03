'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { login as apiLogin, setToken, setUser, getConfig } from '@/lib/api';
import { ThemeToggle, useTheme } from '@/lib/theme';
import { useEffect } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemLogo, setSystemLogo] = useState(null);
  const [systemLogoDark, setSystemLogoDark] = useState(null);
  const [companyName, setCompanyName] = useState('PopOut Studios');

  useEffect(() => {
    async function loadConfig() {
      const res = await getConfig();
      if (res.success) {
        if (res.data.logo_base64) setSystemLogo(res.data.logo_base64);
        if (res.data.logo_dark_base64) setSystemLogoDark(res.data.logo_dark_base64);
        if (res.data.company_name) setCompanyName(res.data.company_name);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    function updateFavicon() {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      const lightIcon = systemLogo || '/images/logo-light.png';
      const darkIcon = systemLogoDark || '/images/logo-dark.png';

      link.href = document.hidden ? darkIcon : lightIcon;
    }

    document.addEventListener("visibilitychange", updateFavicon);
    updateFavicon();

    return () => document.removeEventListener("visibilitychange", updateFavicon);
  }, [systemLogo, systemLogoDark]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiLogin(username, password);
      if (res.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        router.push('/dashboard');
      } else {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }}>
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-logo">
          {systemLogo ? (
            <img
              src={systemLogo}
              alt={companyName}
              style={{ maxHeight: '60px', maxWidth: '220px', marginBottom: '8px', objectFit: 'contain' }}
            />
          ) : (
            <Image
              src={theme === 'dark' ? '/images/logo-light.png' : '/images/logo-dark.png'}
              alt={companyName}
              width={220}
              height={60}
              style={{ marginBottom: '8px', objectFit: 'contain' }}
              priority
            />
          )}
          <p style={{ fontSize: '0.8125rem', fontWeight: 500, opacity: 0.7, marginTop: '4px' }}>Powered by <strong>PopOut Studios</strong></p>
          <p>Print Office Operations</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || !username || !password}
            style={{ padding: '14px', fontSize: '1rem', marginTop: '8px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          PopOut Studios — Powered by PrintFlow
        </p>
      </div>
    </div>
  );
}
