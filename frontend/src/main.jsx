import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './tailwind.css'
import axios from 'axios'
import { API_BASE_URL } from './config/network.js'

axios.defaults.baseURL = API_BASE_URL

// Ensure theme is applied immediately on app bootstrap
function applyThemeFromStorage() {
  try {
    const theme = localStorage.getItem('theme') || 'light';
    const root = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';

    root.classList.toggle('dark', isDark);
    body && body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);

    // expose for debugging
    window.theme = {
      get: () => localStorage.getItem('theme'),
      set: (next) => { localStorage.setItem('theme', next); applyThemeFromStorage(); }
    };
  } catch (_) {}
}

applyThemeFromStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
