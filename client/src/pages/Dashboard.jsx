import React, { useState, useEffect } from 'react';
import { 
  Calendar, CheckCircle, Clock, AlertTriangle, TrendingUp, 
  Users, BarChart3, ChevronRight, Activity, ArrowUpRight 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell 
} from 'recharts';
import { api } from '../services/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      const res = await api.getDashboardStats();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
      setError('Failed to load dashboard metrics. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4" />
        <p className="text-sm">Loading analytics & headline numbers...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-rose-400">
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-80" />
        <p className="text-sm font-semibold">{error || 'No dashboard data available.'}</p>
      </div>
    );
  }

  const { headlineStats, statusBreakdown, sessionBreakdown, checkinsLast14Days } = data;

  const statCards = [
    {
      title: 'Sessions Today',
      value: headlineStats.sessionsToday,
      subtitle: 'Active conference events',
      icon: Calendar,
      gradient: 'from-blue-600/20 to-indigo-600/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    {
      title: 'Checked In Today',
      value: headlineStats.checkedInToday,
      subtitle: 'Door check-ins recorded',
      icon: CheckCircle,
      gradient: 'from-emerald-600/20 to-teal-600/20',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400'
    },
    {
      title: 'Expired This Week',
      value: headlineStats.expiredThisWeek,
      subtitle: 'Holding window auto-expiries',
      icon: Clock,
      gradient: 'from-amber-600/20 to-orange-600/20',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400'
    },
    {
      title: 'At Capacity Sessions',
      value: headlineStats.sessionsAtCapacity,
      subtitle: '100% full capacity rooms',
      icon: AlertTriangle,
      gradient: 'from-rose-600/20 to-pink-600/20',
      borderColor: 'border-rose-500/30',
      iconColor: 'text-rose-400'
    }
  ];

  const totalRegistrations = statusBreakdown.reduce((acc, curr) => acc + curr.count, 0);

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'RESERVED': return 'status-reserved';
      case 'CONFIRMED': return 'status-confirmed';
      case 'CHECKED_IN': return 'status-checked_in';
      case 'EXPIRED': return 'status-expired';
      case 'CANCELLED': return 'status-cancelled';
      default: return 'bg-gray-800 text-gray-300';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-100 via-gray-200 to-indigo-300 bg-clip-text text-transparent">
            System Analytics & Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time attendance metrics, capacity tracking, and check-in trends</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel text-xs text-indigo-300 font-semibold">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Holding Window Expiry Worker Active</span>
        </div>
      </div>

      {/* 1. Headline Stat Cards (Requirement 8) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl glass-card border ${card.borderColor} bg-gradient-to-br ${card.gradient} relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{card.title}</span>
                <div className={`p-2.5 rounded-xl bg-gray-900/60 ${card.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-black text-gray-100">{card.value}</div>
                <div className="text-xs text-gray-400 mt-1">{card.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 14-Day Check-ins Chart (Requirement 8) */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-card border border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-gray-100">Check-in Volume (Last 14 Days)</h3>
            </div>
            <span className="text-xs font-semibold text-gray-400">Attendees Checked In</span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkinsLast14Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
                <XAxis dataKey="displayDate" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    borderColor: '#374151',
                    borderRadius: '0.75rem',
                    color: '#f9fafb',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="checkIns" radius={[6, 6, 0, 0]}>
                  {checkinsLast14Days.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.checkIns > 0 ? '#6366f1' : '#374151'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Breakdown Box (Requirement 8) */}
        <div className="p-6 rounded-2xl glass-card border border-gray-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-100">Registrations by Status</h3>
            <span className="text-xs font-bold text-indigo-400">{totalRegistrations} Total</span>
          </div>

          <div className="space-y-3 pt-2">
            {statusBreakdown.map((item) => {
              const pct = totalRegistrations > 0 ? Math.round((item.count / totalRegistrations) * 100) : 0;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`status-badge ${getStatusBadgeStyle(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="font-bold text-gray-300">{item.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        item.status === 'CHECKED_IN' ? 'bg-emerald-500' :
                        item.status === 'CONFIRMED' ? 'bg-blue-500' :
                        item.status === 'RESERVED' ? 'bg-amber-500' :
                        item.status === 'EXPIRED' ? 'bg-gray-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. Session Capacity Breakdown Table (Requirement 8) */}
      <div className="p-6 rounded-2xl glass-card border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Session Capacity & Seat Matrix</h3>
            <p className="text-xs text-gray-400">Breakdown of reserved, confirmed, and checked-in attendees per session</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-xs font-semibold uppercase text-gray-400 border-b border-gray-800">
              <tr>
                <th className="py-3 px-4">Session & Event</th>
                <th className="py-3 px-4">Capacity Status</th>
                <th className="py-3 px-4">Reserved</th>
                <th className="py-3 px-4">Confirmed</th>
                <th className="py-3 px-4">Checked In</th>
                <th className="py-3 px-4">Expired/Cancelled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {sessionBreakdown.map((session) => {
                const activeTotal = (session.reserved_count || 0) + (session.confirmed_count || 0) + (session.checked_in_count || 0);
                const isFull = activeTotal >= session.capacity;
                const fillPct = Math.min(100, Math.round((activeTotal / session.capacity) * 100));

                return (
                  <tr key={session.session_id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-100">{session.session_title}</div>
                      <div className="text-xs text-gray-400">{session.event_name}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className={isFull ? 'text-rose-400 font-bold' : 'text-gray-300'}>
                            {activeTotal} / {session.capacity} Seats
                          </span>
                          {isFull && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              AT CAPACITY
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 w-36 bg-gray-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isFull ? 'bg-rose-500' : 'bg-indigo-500'}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-amber-400">{session.reserved_count || 0}</td>
                    <td className="py-3.5 px-4 font-semibold text-blue-400">{session.confirmed_count || 0}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-400">{session.checked_in_count || 0}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {session.expired_count || 0} Expired / {session.cancelled_count || 0} Cancelled
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
