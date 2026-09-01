import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Lock, Mail, User, ArrowRight, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ORGANIZER');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setIsRegisterMode(false);
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0f19] relative overflow-hidden">
      
      {/* Background Aesthetic Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/30 mb-3">
            <Calendar className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            EventHub Portal
          </h1>
          <p className="text-xs text-gray-400 mt-1">Sign in or register a new account to manage conference door check-ins</p>
        </div>

        {/* Tab Toggle: Sign In vs Create Account */}
        <div className="flex bg-gray-900/80 p-1 rounded-2xl border border-gray-800 mb-6">
          <button
            type="button"
            onClick={() => { setIsRegisterMode(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              !isRegisterMode
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegisterMode(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              isRegisterMode
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Glass Card */}
        <div className="glass-card p-8 rounded-3xl border border-gray-800 shadow-2xl">
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@eventhub.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                />
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('ORGANIZER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      role === 'ORGANIZER'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : 'bg-gray-900/60 text-gray-400 border-gray-800'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Organizer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('CHECKIN_STAFF')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      role === 'CHECKIN_STAFF'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-gray-900/60 text-gray-400 border-gray-800'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Check-in Staff</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>{isRegisterMode ? 'Register Account' : 'Sign In'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          {!isRegisterMode && (
            <div className="mt-6 pt-5 border-t border-gray-800/80">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-400 mb-2.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Demo Credentials</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('organizer@eventhub.com', 'password123')}
                  className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-left transition-colors"
                >
                  <div className="flex items-center gap-1 text-purple-300 font-bold text-[11px]">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Organizer</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">organizer@eventhub.com</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('staff@eventhub.com', 'password123')}
                  className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-left transition-colors"
                >
                  <div className="flex items-center gap-1 text-emerald-300 font-bold text-[11px]">
                    <UserCheck className="w-3 h-3" />
                    <span>Check-in Staff</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">staff@eventhub.com</div>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
