import { useEffect } from 'react';

export default function DashboardUserModal({
  open,
  title,
  description,
  users,
  loading,
  emptyMessage = 'No users found for this section.',
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-user-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h2
              id="dashboard-user-modal-title"
              className="text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>

          <button className="btn-outline" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="max-h-[calc(85vh-96px)] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {emptyMessage}
            </div>
          ) : (
            <ul className="space-y-3">
              {users.map((entry) => (
                <li
                  key={entry._id || entry.email}
                  className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {entry.name || 'Unnamed User'}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {entry.email || 'No email available'}
                  </div>
                  {typeof entry.registrations === 'number' ? (
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                      {entry.registrations} registration{entry.registrations === 1 ? '' : 's'}
                    </div>
                  ) : null}
                  {Array.isArray(entry.events) && entry.events.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.events.map((event) => (
                        <span
                          key={event._id || event.title}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          {event.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
