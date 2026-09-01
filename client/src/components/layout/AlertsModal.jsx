import React from 'react';
import { AlertTriangle, X, CheckCircle, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AlertsModal({ isOpen, onClose, alerts, onAlertDismissed }) {
  const { isOrganizer } = useAuth();

  if (!isOpen) return null;

  const handleDismiss = async (alertId) => {
    try {
      await api.dismissAlert(alertId);
      if (onAlertDismissed) {
        onAlertDismissed(alertId);
      }
    } catch (err) {
      alert(err.message || 'Failed to dismiss alert');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden glass-card rounded-2xl border border-rose-500/30 p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-100">At-Capacity Alerts</h3>
              <p className="text-xs text-gray-400">Sessions that have reached 100% seat capacity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-400/60 mb-2" />
              <p className="text-sm">No sessions currently at capacity.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-xl bg-gray-900/60 border border-rose-500/20 hover:border-rose-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        AT CAPACITY ({alert.capacity_count}/{alert.capacity})
                      </span>
                      <span className="text-xs text-gray-400">{alert.event_name}</span>
                    </div>
                    <h4 className="mt-1.5 text-base font-semibold text-gray-100">{alert.session_title}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Triggered on: {new Date(alert.updated_at || alert.created_at).toLocaleString()}
                    </p>
                  </div>

                  {isOrganizer && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white rounded-lg border border-gray-700 transition-colors shrink-0"
                    >
                      Dismiss Alert
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
