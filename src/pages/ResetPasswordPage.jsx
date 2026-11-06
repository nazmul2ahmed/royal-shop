import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import './ResetPasswordPage.css';

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Password কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }

    if (password !== confirmPassword) {
      setError('দুটি Password মিলছে না।');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const sessionUserId = sessionData.session?.user?.id;

      if (!sessionUserId) {
        throw new Error(
          'সক্রিয় Supabase Session পাওয়া যায়নি। নতুন Reset Email পাঠান।'
        );
      }

      const { data: adminRecord, error: roleError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', sessionUserId)
        .maybeSingle();

      if (roleError) {
        throw new Error('Admin permission যাচাই করা যায়নি।');
      }

      if (!adminRecord) {
        throw new Error(
          'এই Account-এর Password পরিবর্তনের অনুমতি নেই।'
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setSuccess(
        'Password সফলভাবে পরিবর্তন হয়েছে। এখন Admin Login করুন।'
      );

      const { error: signOutError } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutError) {
        console.error('Post-recovery sign out failed:', signOutError);
      }

      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Password পরিবর্তন করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rs-reset-page">
      <section className="rs-reset-card">
        <div className="rs-reset-logo">R</div>
        <h1>Set New Password</h1>
        <p>আপনার Royal Shop Admin Account-এর নতুন Password দিন।</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="কমপক্ষে ৮ অক্ষর"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="আবার Password লিখুন"
            autoComplete="new-password"
            required
          />

          {error && (
            <p className="rs-reset-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="rs-reset-success" role="status">
              {success}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Update Password'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ResetPasswordPage;
