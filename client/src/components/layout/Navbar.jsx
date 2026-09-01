import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, Users, Ticket, Bell, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import AlertsModal from './AlertsModal';

export default function Navbar() {
  const { user, logout, isOrganizer } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await api.getAlerts();
      setAlerts(res.alerts || []);
      setBadgeCount(res.badgeCount || 0);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 15000); // Poll alerts every 15s
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/events', label: 'Events & Sessions', icon: Calendar },
    { path: '/registrations', label: 'Registrations', icon: Ticket },
    ...(isOrganizer ? [{ path: '/staff', label: 'Staff Assignments', icon: Users }] : [])
  ];

  return (
    <>
      <nav className="sticky top-0 z-40 w-full glass-panel border-b border-gray-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                EventHub
              </span>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-indigo-400/80">
                Conference & Door System
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1 bg-gray-900/60 p-1.5 rounded-xl border border-gray-800">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            
            {/* At-Capacity Alerts Badge Trigger (Requirement 10) */}
            <button
              onClick={() => setIsAlertsOpen(true)}
              className="relative p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-all hover:scale-105"
              title="At-Capacity Alerts"
            >
              <Bell className="w-5 h-5" />
              {badgeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-500/50 animate-bounce">
                  {badgeCount}
                </span>
              )}
            </button>

            {/* User Profile Card */}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-gray-800">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-gray-200">{user.name}</div>
                  <div className="flex items-center justify-end gap-1 text-xs font-semibold">
                    {user.role === 'ORGANIZER' ? (
                      <span className="text-purple-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Organizer
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Check-in Staff
                      </span>
                    )}
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-400 hover:text-rose-400 hover:border-rose-500/30 transition-all hover:scale-105"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>
      </nav>

      {/* Alerts Modal Popup */}
      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        onAlertDismissed={() => fetchAlerts()}
      />
    </>
  );
}
