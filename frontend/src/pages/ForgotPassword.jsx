import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setMessage(
        res.data?.message ||
          'If an account exists for that email, a password reset link has been sent.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send reset email');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="font-bold text-xl">Forgot password</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Enter your email address and we will send you a reset link.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn w-full" disabled={submitting} type="submit">
          {submitting ? 'Sending link...' : 'Send reset link'}
        </button>
      </form>

      <div className="text-sm text-slate-600 dark:text-slate-300">
        Remembered your password?{' '}
        <Link to="/login" className="underline">
          Go back to login
        </Link>
      </div>
    </div>
  );
}
