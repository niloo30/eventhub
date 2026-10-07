import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { token } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/auth/me', token ? { headers: { Authorization: `Bearer ${token}` } } : {});
        setUser(res.data.user || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!user) return <div>No profile found.</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-200">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-700">{(user.name||'')[0]||'U'}</div>
            )}
          </div>
          <div>
            <div className="text-lg font-semibold">{user.name}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
            <div className="text-xs text-slate-400 mt-2">Role: {user.role}</div>
            <div className="text-xs text-slate-400">Joined: {user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}</div>
            <div className="text-xs text-slate-400">Wallet balance: ₹{Number(user.walletBalance || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
