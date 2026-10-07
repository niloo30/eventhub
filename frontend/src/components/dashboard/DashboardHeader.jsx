import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';

export default function DashboardHeader({
  title,
  subtitle,
  user,
  onLogout,
  actions,
  profilePanel,
  menuItems = [],
}) {
  const roleLabel = user?.role
    ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
    : "User";

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  };

  const avatarSrc = user?.avatar || user?.image || user?.picture || null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
          {roleLabel} Dashboard
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        ) : null}
        <div className="inline-flex items-center gap-3">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((s) => !s);
              }}
              className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-700 dark:text-slate-200 overflow-hidden focus:outline-none"
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(user?.name)}</span>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-md bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick && item.onClick();
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile');
                    }}
                  >
                    My Profile
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setMenuOpen(false);
                      // TODO: navigate to settings page
                    }}
                  >
                    Settings
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout && onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300">
            Signed in as {user?.name}
          </div>
        </div>
        {profilePanel ? <div className="pt-2">{profilePanel}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {actions}
        <button className="btn-outline" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
