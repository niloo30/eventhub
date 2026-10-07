import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyToken() {
      if (!token) {
        setChecking(false);
        setValidToken(false);
        setError('Reset link is missing. Please request a new password reset email.');
        return;
      }

      setChecking(true);
      setError('');

      try {
        const res = await axios.get(`/api/auth/reset-password/verify/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setValidToken(true);
        setMessage(res.data?.message || 'Reset link verified.');
      } catch (err) {
        if (cancelled) return;
        setValidToken(false);
        setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    verifyToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const res = await axios.post('/api/auth/reset-password', { token, password });
      navigate('/login', {
        replace: true,
        state: {
          message:
            res.data?.message || 'Password reset successful. Please log in with your new password.',
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="font-bold text-xl">Reset password</h1>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Verifying your reset link...
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="font-bold text-xl">Reset password</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
        <Link to="/forgot-password" className="btn w-full">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="font-bold text-xl">Set a new password</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Choose a new password for your account.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input w-full"
          placeholder="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="input w-full"
          placeholder="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button className="btn w-full" disabled={submitting} type="submit">
          {submitting ? 'Resetting password...' : 'Reset password'}
        </button>
      </form>

      <div className="text-sm text-slate-600 dark:text-slate-300">
        Back to{' '}
        <Link to="/login" className="underline">
          login
        </Link>
      </div>
    </div>
  );
}
