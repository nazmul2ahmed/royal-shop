import { businessConfig } from '../config/business.config.js';

import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase.js';
import './AdminLoginPage.css';

function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) throw loginError;

      const { data: adminRecord, error: roleError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (roleError) {
        await supabase.auth.signOut();
        throw new Error('Admin permission could not be verified.');
      }

      if (!adminRecord) {
        await supabase.auth.signOut();
        throw new Error('You are not authorized to access the Admin Panel.');
      }

      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setError('');
    setRecoveryMessage('');
    setLoading(true);

    try {
      const { error: recoveryError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin/reset-password`,
        });

      if (recoveryError) throw recoveryError;

      setRecoveryMessage(
        'If an account exists for this email, password reset instructions will be sent. Please check your inbox.'
      );
    } catch {
      setError(
        'Unable to process your request right now. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  const showLogin = () => {
    setIsForgotPassword(false);
    setError('');
    setRecoveryMessage('');
  };

  return (
    <main className="rs-admin-login-page">
      <section className="rs-admin-login-card">
        <div className="rs-admin-login-brand">
          <span className="rs-admin-login-logo">R</span>
          <p>{businessConfig.shortName}</p>
        </div>

        {isForgotPassword ? (
          <>
            <h1>Reset Password</h1>
            <p className="rs-admin-login-subtitle">
              Enter your email address to receive password reset instructions.
            </p>

            <form onSubmit={handleForgotPassword}>
              <label htmlFor="admin-recovery-email">Email Address</label>
              <input
                id="admin-recovery-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />

              {error && (
                <p className="rs-admin-login-error" role="alert">
                  {error}
                </p>
              )}

              {recoveryMessage && (
                <p className="rs-admin-login-success" role="status">
                  {recoveryMessage}
                </p>
              )}

              <button type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Instructions'}
              </button>
            </form>

            <button
              type="button"
              className="rs-admin-login-back"
              onClick={showLogin}
            >
              Back to Admin Login
            </button>
          </>
        ) : (
          <>
            <h1>Admin Login</h1>
            <p className="rs-admin-login-subtitle">
              Sign in to manage your {businessConfig.name}.
            </p>

            <form onSubmit={handleLogin}>
              <label htmlFor="admin-email">Email Address</label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="username"
                required
              />

              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />

              {error && (
                <p className="rs-admin-login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Sign In to Admin'}
              </button>
            </form>

            <button
              type="button"
              className="rs-admin-login-forgot"
              onClick={() => {
                setError('');
                setRecoveryMessage('');
                setIsForgotPassword(true);
              }}
            >
              Forgot Password?
            </button>
          </>
        )}

        <p className="rs-admin-login-footer">
          Authorized personnel only.
        </p>
      </section>
    </main>
  );
}

export default AdminLoginPage;


