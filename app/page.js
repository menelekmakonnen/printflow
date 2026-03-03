'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { login as apiLogin, setToken, setUser } from '@/lib/api';
import { ThemeToggle, useTheme } from '@/lib/theme';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          <Image
            src={theme === 'dark' ? '/images/logo-light.png' : '/images/logo-dark.png'}
            alt="PopOut Studios"
            width={220}
            height={60}
            style={{ marginBottom: '8px', objectFit: 'contain' }}
            priority
          />
          <p style={{ fontSize: '0.8125rem', fontWeight: 500, opacity: 0.7, marginTop: '4px' }}>Powered by <strong>PrintFlow</strong></p>
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
