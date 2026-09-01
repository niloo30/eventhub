import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, Calendar, MapPin, Clock, Plus, Trash2, Shield, CheckCircle, Ticket 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function StaffAssignments() {
  const { user, isOrganizer } = useAuth();

  const [staffMembers, setStaffMembers] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [targetSessionId, setTargetSessionId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      if (isOrganizer) {
        const staffRes = await api.getStaff();
        setStaffMembers(staffRes.staffMembers || []);
        const sessRes = await api.getSessions();
        setSessions(sessRes.sessions || []);
      }
      const mySessRes = await api.getMySessions();
      setMySessions(mySessRes.sessions || []);
    } catch (err) {
      console.error('Failed to load staff assignment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isOrganizer]);

  const handleAssignStaff = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!targetUserId || !targetSessionId) {
      setActionError('Please select both a staff member and a session');
      return;
    }

    try {
      const res = await api.assignStaff(targetUserId, targetSessionId);
      setActionSuccess(res.message);
      setIsAssignModalOpen(false);
      setTargetUserId('');
      setTargetSessionId('');
      fetchData();
    } catch (err) {
      setActionError(err.message || 'Failed to assign staff');
    }
  };

  const handleUnassignStaff = async (userId, sessionId) => {
    if (!window.confirm('Are you sure you want to remove this staff assignment?')) {
      return;
    }
    try {
      await api.unassignStaff(userId, sessionId);
      setActionSuccess('Staff assignment removed.');
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to remove assignment');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4" />
        <p className="text-sm">Loading staff assignments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-100 via-gray-200 to-indigo-300 bg-clip-text text-transparent">
            {isOrganizer ? 'Staff Assignments Portal' : 'My Assigned Sessions'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isOrganizer
              ? 'Assign check-in staff members to specific conference sessions'
              : 'Sessions assigned to you for door check-in management'}
          </p>
        </div>

        {isOrganizer && (
          <button
            onClick={() => {
              setActionError('');
              setIsAssignModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Staff to Session</span>
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-semibold">
          {actionSuccess}
        </div>
      )}

      {/* 1. Check-in Staff Member View: My Assigned Sessions List (Requirement 5) */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
          {isOrganizer ? 'Your Personal Session Assignments' : 'Assigned Sessions List'} ({mySessions.length})
        </h3>

        {mySessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 glass-card rounded-2xl">
            <UserCheck className="w-10 h-10 mx-auto text-gray-600 mb-2" />
            <p className="text-sm">No sessions currently assigned to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mySessions.map((session) => (
              <div key={session.id} className="p-5 rounded-2xl glass-card border border-gray-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs text-indigo-400 font-semibold">{session.event_name}</span>
                    <h4 className="text-base font-bold text-gray-100 mt-0.5">{session.title}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ASSIGNED
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{new Date(session.start_time).toLocaleString()} ({session.duration_mins} mins)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <span>{session.location} ({session.event_venue})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="w-3.5 h-3.5 text-amber-400" />
                    <span>{session.active_registrations_count || 0} / {session.capacity} Seats Filled</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Organizer Staff Assignment Management Matrix (Requirement 5) */}
      {isOrganizer && (
        <div className="pt-6 space-y-4 border-t border-gray-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
            All Check-in Staff Members ({staffMembers.length})
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {staffMembers.map((staff) => (
              <div key={staff.id} className="p-6 rounded-2xl glass-card border border-gray-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-100">{staff.name}</h4>
                      <p className="text-xs text-gray-400">{staff.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    {staff.assignments.length} Sessions Assigned
                  </span>
                </div>

                {/* Assigned Sessions List */}
                <div className="space-y-2">
                  {staff.assignments.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2">No session assignments currently assigned.</p>
                  ) : (
                    staff.assignments.map((asgn) => (
                      <div
                        key={asgn.assignment_id}
                        className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-gray-200">{asgn.session_title}</div>
                          <div className="text-[11px] text-gray-400">{asgn.event_name}</div>
                        </div>
                        <button
                          onClick={() => handleUnassignStaff(staff.id, asgn.session_id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Remove Assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Assign Staff Member to Session</h3>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAssignStaff} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Check-in Staff Member</label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select staff member...</option>
                  {staffMembers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Target Session</label>
                <select
                  required
                  value={targetSessionId}
                  onChange={(e) => setTargetSessionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.location})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Assign Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
