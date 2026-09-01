import React, { useState, useEffect } from 'react';
import { 
  Ticket, Search, Filter, Plus, FileSpreadsheet, Download, History, 
  CheckCircle, Clock, XCircle, ArrowRight, User, Mail, AlertTriangle, X 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Registrations() {
  const { user, isOrganizer } = useAuth();

  const [registrations, setRegistrations] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter Parameters
  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('reserved_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ session_id: '', attendee_name: '', attendee_email: '', notes: '' });

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState(null);
  const [targetStatus, setTargetStatus] = useState('CONFIRMED');
  const [statusNotes, setStatusNotes] = useState('');

  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [timelineData, setTimelineData] = useState(null);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [csvReport, setCsvReport] = useState(null);
  const [csvSessionId, setCsvSessionId] = useState('');

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Fetch Filter Dropdown Data
  useEffect(() => {
    api.getEvents(true).then(res => setEvents(res.events || [])).catch(console.error);
    api.getSessions().then(res => setSessions(res.sessions || [])).catch(console.error);
  }, []);

  // Fetch Registrations Data (Server-side Search, Filtering, Pagination)
  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const res = await api.getRegistrations({
        search,
        eventId,
        sessionId,
        status,
        sortBy,
        sortOrder,
        page,
        limit: 10
      });
      setRegistrations(res.registrations || []);
      setPagination(res.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (err) {
      console.error('Fetch registrations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [search, eventId, sessionId, status, sortBy, sortOrder, page]);

  // Create Registration
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      await api.createRegistration(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ session_id: '', attendee_name: '', attendee_email: '', notes: '' });
      setActionSuccess('Seat reservation created successfully!');
      fetchRegistrations();
    } catch (err) {
      setActionError(err.message || 'Failed to create reservation');
    }
  };

  // Change Registration Status
  const handleOpenStatusModal = (reg) => {
    setSelectedReg(reg);
    setActionError('');
    if (reg.status === 'RESERVED') setTargetStatus('CONFIRMED');
    else if (reg.status === 'CONFIRMED') setTargetStatus('CHECKED_IN');
    else setTargetStatus('CANCELLED');
    setStatusNotes('');
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!selectedReg) return;

    try {
      await api.updateRegistrationStatus(selectedReg.id, targetStatus, statusNotes);
      setIsStatusModalOpen(false);
      setActionSuccess(`Status updated to ${targetStatus}`);
      fetchRegistrations();
    } catch (err) {
      setActionError(err.message || 'Failed to update status');
    }
  };

  // View Timeline Audit Log
  const handleOpenTimeline = async (regId) => {
    try {
      const res = await api.getRegistrationHistory(regId);
      setTimelineData(res);
      setIsTimelineModalOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to fetch timeline history');
    }
  };

  // CSV Bulk Import
  const handleCsvImport = async (e) => {
    e.preventDefault();
    setActionError('');
    setCsvReport(null);
    if (!csvSessionId || !csvContent) {
      setActionError('Session and CSV content are required');
      return;
    }

    try {
      const res = await api.importCsv(csvSessionId, csvContent);
      setCsvReport(res.report);
      setActionSuccess(res.message);
      fetchRegistrations();
    } catch (err) {
      setActionError(err.message || 'Failed to process CSV import');
    }
  };

  // CSV Export Check-in Sheet
  const handleExportCsv = (sessId) => {
    if (!sessId) {
      alert('Please select a session from the session filter to export its check-in sheet.');
      return;
    }
    const url = api.exportCsvUrl(sessId);
    window.open(url, '_blank');
  };

  const getStatusBadgeClass = (s) => {
    switch (s) {
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
      
      {/* Page Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-100 via-gray-200 to-indigo-300 bg-clip-text text-transparent">
            Attendee Registrations
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage seat reservations, state transitions, door check-ins, and bulk CSV actions</p>
        </div>

        <div className="flex items-center gap-3">
          {/* CSV Bulk Import Button */}
          {isOrganizer && (
            <button
              onClick={() => {
                setCsvReport(null);
                setActionError('');
                setIsCsvModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold text-xs transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Bulk CSV Import</span>
            </button>
          )}

          {/* New Reservation Button */}
          <button
            onClick={() => {
              setActionError('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-semibold flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Multi-Filter Control Bar (Requirement 6) */}
      <div className="p-5 rounded-2xl glass-card border border-gray-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Text Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or email..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 text-xs placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Event Filter */}
          <select
            value={eventId}
            onChange={(e) => { setEventId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Events</option>
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>{evt.name}</option>
            ))}
          </select>

          {/* Session Filter */}
          <select
            value={sessionId}
            onChange={(e) => { setSessionId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Sessions</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="RESERVED">RESERVED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CHECKED_IN">CHECKED_IN</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

        </div>

        {/* Sorting & CSV Export Button Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-800/60">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 text-xs"
            >
              <option value="reserved_at">Reserved Time</option>
              <option value="status">Status</option>
              <option value="session_title">Session Title</option>
              <option value="attendee_name">Attendee Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 text-xs hover:text-white"
            >
              {sortOrder}
            </button>
          </div>

          {/* Export CSV Check-in Sheet (Requirement 7) */}
          {sessionId && (
            <button
              onClick={() => handleExportCsv(sessionId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Check-in Sheet (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Searchable Registration Table (Requirement 6) */}
      <div className="p-6 rounded-2xl glass-card border border-gray-800 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-xs font-semibold uppercase text-gray-400 border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Attendee</th>
                <th className="py-3.5 px-4">Session & Event</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Reserved Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">Loading registrations...</td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">No matching registration records found.</td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-100 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{reg.attendee_name}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-gray-500" />
                        <span>{reg.attendee_email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-200">{reg.session_title}</div>
                      <div className="text-xs text-gray-400">{reg.event_name}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`status-badge ${getStatusBadgeClass(reg.status)}`}>
                        {reg.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {new Date(reg.reserved_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        
                        {/* Status Transition Action Button */}
                        {!['EXPIRED', 'CANCELLED'].includes(reg.status) && (
                          <button
                            onClick={() => handleOpenStatusModal(reg)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs transition-colors"
                          >
                            Update Status
                          </button>
                        )}

                        {/* Audit Log Timeline Button (Requirement 9) */}
                        <button
                          onClick={() => handleOpenTimeline(reg.id)}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                          title="View Immutable Audit Log Timeline"
                        >
                          <History className="w-4 h-4" />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Controls (Requirement 6) */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800/80 text-xs text-gray-400">
          <div>
            Showing {registrations.length} of <span className="font-bold text-gray-200">{pagination.total}</span> matches
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 disabled:opacity-40 hover:bg-gray-700 text-gray-200"
            >
              Previous
            </button>
            <span className="font-semibold text-gray-300">Page {pagination.page} of {pagination.totalPages || 1}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 disabled:opacity-40 hover:bg-gray-700 text-gray-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* New Reservation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-gray-100 mb-4">Create Seat Reservation</h3>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreateReservation} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Target Session</label>
                <select
                  required
                  value={createForm.session_id}
                  onChange={(e) => setCreateForm({ ...createForm, session_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select a session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Attendee Name</label>
                <input
                  type="text"
                  required
                  value={createForm.attendee_name}
                  onChange={(e) => setCreateForm({ ...createForm, attendee_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Attendee Email</label>
                <input
                  type="email"
                  required
                  value={createForm.attendee_email}
                  onChange={(e) => setCreateForm({ ...createForm, attendee_email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Reservation Note (Optional)</label>
                <input
                  type="text"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="VIP attendee / Early registration"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Reserve Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Status Modal (Requirement 4) */}
      {isStatusModalOpen && selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-gray-100 mb-2">Update Registration Status</h3>
            <p className="text-xs text-gray-400 mb-4">
              Current: <span className={`status-badge ${getStatusBadgeClass(selectedReg.status)}`}>{selectedReg.status}</span>
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Target Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  {selectedReg.status === 'RESERVED' && <option value="CONFIRMED">CONFIRMED</option>}
                  {['RESERVED', 'CONFIRMED'].includes(selectedReg.status) && <option value="CHECKED_IN">CHECKED_IN (Door Check-in)</option>}
                  {['RESERVED', 'CONFIRMED'].includes(selectedReg.status) && <option value="CANCELLED">CANCELLED (Frees Seat)</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Staff Note for Audit Trail</label>
                <input
                  type="text"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Checked in at front desk / Confirmed via email"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Immutable Audit Log Timeline Modal (Requirement 9) */}
      {isTimelineModalOpen && timelineData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 border border-gray-800 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-100">Immutable Audit Timeline</h3>
                <p className="text-xs text-gray-400">
                  {timelineData.registration.attendee_name} ({timelineData.registration.attendee_email})
                </p>
              </div>
              <button onClick={() => setIsTimelineModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
              {timelineData.history.map((item, idx) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-gray-900" />
                  <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-300">
                        {item.old_status ? `${item.old_status} → ${item.new_status}` : `Initial Status: ${item.new_status}`}
                      </span>
                      <span className="text-gray-500">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      By: <span className="font-semibold text-gray-200">{item.actor_name}</span> ({item.actor_role || 'System'})
                    </div>
                    {item.notes && <div className="text-xs text-gray-300 italic pt-1">"{item.notes}"</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-800 text-right mt-4">
              <button
                onClick={() => setIsTimelineModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-300 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal (Requirement 7) */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-card rounded-2xl p-6 border border-gray-800 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-100 mb-1">Bulk Import Attendees (CSV)</h3>
            <p className="text-xs text-gray-400 mb-4">Import attendee lists from CSV with per-row validation reporting</p>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCsvImport} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Target Session</label>
                <select
                  required
                  value={csvSessionId}
                  onChange={(e) => setCsvSessionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select target session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Paste CSV Content (Columns: `name, email`)</label>
                <textarea
                  rows={5}
                  required
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={`name,email\nAlice Smith,alice@example.com\nBob Jones,bob@example.com`}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  Process Bulk Import
                </button>
              </div>
            </form>

            {/* Per-Row CSV Report (Requirement 7) */}
            {csvReport && (
              <div className="mt-6 pt-4 border-t border-gray-800 space-y-3">
                <h4 className="text-sm font-bold text-gray-200">CSV Import Report</h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    {csvReport.createdCount} Created
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                    {csvReport.duplicateCount} Duplicates
                  </div>
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                    {csvReport.rejectedCount} Rejected
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto border border-gray-800 rounded-xl divide-y divide-gray-800 text-xs">
                  {csvReport.rowResults.map((r, i) => (
                    <div key={i} className="p-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-200">Row {r.row}: {r.name}</span> ({r.email})
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'CREATED' ? 'bg-emerald-500/20 text-emerald-300' :
                        r.status === 'DUPLICATE' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {r.status}: {r.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
