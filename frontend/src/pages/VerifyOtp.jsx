import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function parseTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VerifyOtp() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const otpInputRef = useRef(null);

  const email = searchParams.get('email') || '';
  const purpose = searchParams.get('purpose') || 'login';
  const initialOtp = searchParams.get('otp') || '';
  const initialExpiresAt = parseTimestamp(searchParams.get('expiresAt'));
  const initialResendAvailableAt = parseTimestamp(searchParams.get('resendAvailableAt'));

  const initialEmailDeliveryFailed = searchParams.get('emailDeliveryFailed') === 'true';

  const [otp, setOtp] = useState(initialOtp);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(initialEmailDeliveryFailed);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    location.state?.message ||
      (purpose === 'signup'
        ? 'Enter the OTP sent to your email to verify your account.'
        : 'Enter the OTP sent to your email to complete login.')
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [resendAvailableAt, setResendAvailableAt] = useState(initialResendAvailableAt);
  const [now, setNow] = useState(Date.now());

  const secondsUntilExpiry = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 1000))
    : null;
  const secondsUntilResend = resendAvailableAt
    ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
    : 0;
  const isResendDisabled = resending || secondsUntilResend > 0;

  useEffect(() => {
    otpInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!email || initialOtp.length !== 6) return;

    setOtp(initialOtp);
    void submitOtp(initialOtp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, initialOtp]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function submitOtp(otpValue = otp) {
    if (submitting || otpValue.length !== 6) return;

    setError('');
    setSubmitting(true);

    try {
      const res = await axios.post('/api/auth/otp/verify', {
        email,
        otp: otpValue,
      });
      login(res.data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    await submitOtp();
  }

  function handleOtpChange(e) {
    const nextOtp = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(nextOtp);

    if (nextOtp.length === 6) {
      void submitOtp(nextOtp);
    }
  }

  async function resendOtp() {
    if (isResendDisabled) return;

    setError('');
    setResending(true);

    try {
      const res = await axios.post('/api/auth/otp/resend', { email });
      const nextExpiresAt = parseTimestamp(res.data?.expiresAt);
      const nextResendAvailableAt = parseTimestamp(res.data?.resendAvailableAt);

      const nextOtp = res.data?.otpCode || '';
      setOtp(nextOtp);
      setEmailDeliveryFailed(Boolean(res.data?.emailDeliveryFailed));
      setMessage(res.data?.message || 'A new OTP has been sent to your email address.');
      setExpiresAt(nextExpiresAt);
      setResendAvailableAt(nextResendAvailableAt);

      setSearchParams({
        email: res.data?.email || email,
        purpose: res.data?.purpose || purpose,
        ...(nextOtp ? { otp: nextOtp } : {}),
        ...(res.data?.expiresAt ? { expiresAt: res.data.expiresAt } : {}),
        ...(res.data?.resendAvailableAt
          ? { resendAvailableAt: res.data.resendAvailableAt }
          : {}),
        ...(res.data?.emailDeliveryFailed ? { emailDeliveryFailed: 'true' } : {}),
      });
      otpInputRef.current?.focus();
    } catch (err) {
      const retryAfterSeconds = Number(err.response?.data?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        setResendAvailableAt(Date.now() + retryAfterSeconds * 1000);
      }
      setError(err.response?.data?.message || 'Unable to resend OTP');
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="font-bold text-xl">Verify OTP</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          OTP session details are missing. Please start the auth flow again.
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Go to <Link to="/login" className="underline">login</Link> or{' '}
          <Link to="/signup" className="underline">signup</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="font-bold text-xl">
          {purpose === 'signup' ? 'Verify your email' : 'Login OTP'}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {email ? `We sent a 6-digit OTP to ${email}.` : 'Enter the OTP sent to your email.'}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {secondsUntilExpiry !== null && (
            <span>
              {secondsUntilExpiry > 0
                ? `OTP expires in ${formatCountdown(secondsUntilExpiry)}`
                : 'OTP has expired. Request a new code.'}
            </span>
          )}
          <span>
            {secondsUntilResend > 0
              ? `Resend available in ${formatCountdown(secondsUntilResend)}`
              : 'You can request a new OTP now.'}
          </span>
        </div>
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
          ref={otpInputRef}
          className="input w-full text-center tracking-[0.45em] font-semibold"
          disabled={submitting}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={otp}
          onChange={handleOtpChange}
        />
        <button className="btn w-full" disabled={submitting || otp.length !== 6} type="submit">
          {submitting ? 'Verifying OTP...' : 'Verify OTP'}
        </button>
      </form>

      <button
        className="btn-outline w-full"
        disabled={isResendDisabled}
        onClick={resendOtp}
        type="button"
      >
        {resending
          ? 'Sending new OTP...'
          : secondsUntilResend > 0
            ? `Resend OTP in ${formatCountdown(secondsUntilResend)}`
            : 'Resend OTP'}
      </button>

      <div className="text-sm text-slate-600 dark:text-slate-300">
        Back to <Link to="/login" className="underline">login</Link>
      </div>
    </div>
  );
}
