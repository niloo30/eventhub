import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const infoMessage = location.state?.message || '';

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data?.requiresOtp) {
        const query = new URLSearchParams({
          email: res.data.email || email,
          purpose: res.data.purpose || 'login',
          ...(res.data.otpCode ? { otp: res.data.otpCode } : {}),
          ...(res.data.expiresAt ? { expiresAt: res.data.expiresAt } : {}),
          ...(res.data.resendAvailableAt
            ? { resendAvailableAt: res.data.resendAvailableAt }
            : {}),
          ...(res.data.emailDeliveryFailed ? { emailDeliveryFailed: 'true' } : {}),
        }).toString();

        nav(`/verify-otp?${query}`, {
          state: { message: res.data?.message || 'Enter the OTP sent to your email.' },
        });
        return;
      }

      login(res.data);
      nav('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="font-bold text-xl mb-4">Login</h1>
      {infoMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">{infoMessage}</div>}
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="input w-full" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="input w-full" type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="btn w-full">Login</button>
      </form>
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Forgot your password? <Link to="/forgot-password" className="underline">Reset it here</Link>
      </div>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm">
        <div className="font-semibold mb-1">Demo credentials</div>
        <ul className="space-y-1">
          <li><span className="font-medium">Customer</span>: customer@example.com / password</li>
          <li><span className="font-medium">Organizer</span>: organizer@example.com / password</li>
          <li><span className="font-medium">Admin</span>: admin@example.com / password</li>
        </ul>
      </div>
      <div className="text-sm text-slate-600 mt-2">No account? <Link to="/signup" className="underline">Sign up</Link></div>
    </div>
  );
}
