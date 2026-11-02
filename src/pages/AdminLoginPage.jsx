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

  return (
    <main className="rs-admin-login-page">
      <section className="rs-admin-login-card">
        <div className="rs-admin-login-brand">
          <span className="rs-admin-login-logo">R</span>
          <p>ROYAL SHOP</p>
        </div>

        <h1>Admin Login</h1>
        <p className="rs-admin-login-subtitle">
          Sign in to manage your Royal Shop.
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

        <p className="rs-admin-login-footer">
          Authorized personnel only.
        </p>
      </section>
    </main>
  );
}

export default AdminLoginPage;
