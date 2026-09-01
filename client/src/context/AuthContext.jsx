import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('eventhub_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.getMe()
      .then(res => {
        setUser(res.user);
      })
      .catch(err => {
        console.error('Session check failed:', err);
        localStorage.removeItem('eventhub_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    localStorage.setItem('eventhub_token', res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (name, email, password, role) => {
    const res = await api.register(name, email, password, role);
    localStorage.setItem('eventhub_token', res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('eventhub_token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isOrganizer: user?.role === 'ORGANIZER',
    isStaff: user?.role === 'CHECKIN_STAFF'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
