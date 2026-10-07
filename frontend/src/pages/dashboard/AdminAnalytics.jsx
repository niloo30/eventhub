import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext.jsx';

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default function AdminAnalytics({ onClose } = {}) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get('/api/admin/analytics', token ? { headers: { Authorization: `Bearer ${token}` } } : {});
        if (!mounted) return;
        setData(res.data || {});
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.message || 'Unable to load analytics.');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) return <div className="p-6">Loading analytics...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">No analytics available.</div>;

  const { eventStats = [], movieStats = [], totals = {} } = data;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Analytics</h2>
          <p className="text-sm text-slate-500">Overview of registrations and booking revenue.</p>
        </div>
        <div className="flex gap-2">
          {onClose ? (
            <button className="btn-outline" onClick={onClose}>Close</button>
          ) : null}
        </div>
      </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-500">Total Event Revenue</div>
          <div className="mt-2 text-2xl font-bold">{formatCurrency(totals.totalEventRevenue, 'INR')}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-500">Total Movie Revenue</div>
          <div className="mt-2 text-2xl font-bold">{formatCurrency(totals.totalMovieRevenue, 'INR')}</div>
        </div>
        <div className="rounded-2xl border border-slate-100 p-4">
          <div className="text-xs text-slate-500">Total Revenue</div>
          <div className="mt-2 text-2xl font-bold">{formatCurrency(totals.totalRevenue, 'INR')}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Event registrations</h3>
        {eventStats.length === 0 ? (
          <div className="text-sm text-slate-500">No active registrations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2">Event</th>
                  <th className="pb-2">Registrations</th>
                  <th className="pb-2">Unique Users</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {eventStats.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-2">{e.title}</td>
                    <td className="py-2">{e.registrations}</td>
                    <td className="py-2">{e.uniqueUsers}</td>
                    <td className="py-2">{formatCurrency(e.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-lg font-semibold">Movie bookings</h3>
        {movieStats.length === 0 ? (
          <div className="text-sm text-slate-500">No paid movie bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2">Movie</th>
                  <th className="pb-2">Paid Bookings</th>
                  <th className="pb-2">Unique Users</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {movieStats.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2">{m.title}</td>
                    <td className="py-2">{m.paidBookings}</td>
                    <td className="py-2">{m.uniqueUsers}</td>
                    <td className="py-2">{formatCurrency(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
