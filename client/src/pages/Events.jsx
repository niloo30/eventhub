import React, { useState, useEffect } from 'react';
import { 
  Calendar, Plus, Archive, RefreshCw, MapPin, Clock, Users, 
  ChevronDown, ChevronRight, Edit3, Trash2, ShieldAlert, CheckCircle2 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Events() {
  const { isOrganizer } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sessions, setSessions] = useState([]);

  // Modal States
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ name: '', description: '', start_date: '', end_date: '', venue: '' });

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({ title: '', start_time: '', duration_mins: 60, location: '', capacity: 30 });

  const [actionError, setActionError] = useState('');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.getEvents(includeArchived);
      setEvents(res.events || []);
      if (res.events && res.events.length > 0 && !selectedEvent) {
        handleSelectEvent(res.events[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (eventId) => {
    try {
      const res = await api.getEventDetails(eventId);
      setSelectedEvent(res.event);
      setSessions(res.sessions || []);
    } catch (err) {
      console.error('Failed to fetch event sessions:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [includeArchived]);

  // Event Handlers
  const handleOpenEventModal = (event = null) => {
    setActionError('');
    if (event) {
      setEditingEvent(event);
      setEventForm({
        name: event.name,
        description: event.description || '',
        start_date: event.start_date,
        end_date: event.end_date,
        venue: event.venue
      });
    } else {
      setEditingEvent(null);
      setEventForm({ name: '', description: '', start_date: '', end_date: '', venue: '' });
    }
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      if (editingEvent) {
        await api.updateEvent(editingEvent.id, eventForm);
      } else {
        await api.createEvent(eventForm);
      }
      setIsEventModalOpen(false);
      fetchEvents();
    } catch (err) {
      setActionError(err.message || 'Failed to save event');
    }
  };

  const handleToggleArchive = async (event) => {
    try {
      await api.toggleArchiveEvent(event.id);
      fetchEvents();
    } catch (err) {
      alert(err.message || 'Failed to toggle archive status');
    }
  };

  // Session Handlers
  const handleOpenSessionModal = (session = null) => {
    setActionError('');
    if (session) {
      setEditingSession(session);
      setSessionForm({
        title: session.title,
        start_time: session.start_time,
        duration_mins: session.duration_mins,
        location: session.location,
        capacity: session.capacity
      });
    } else {
      setEditingSession(null);
      setSessionForm({
        title: '',
        start_time: new Date().toISOString().slice(0, 16),
        duration_mins: 60,
        location: selectedEvent ? selectedEvent.venue : '',
        capacity: 30
      });
    }
    setIsSessionModalOpen(true);
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!selectedEvent) return;

    try {
      if (editingSession) {
        await api.updateSession(editingSession.id, sessionForm);
      } else {
        await api.createSession({ ...sessionForm, event_id: selectedEvent.id });
      }
      setIsSessionModalOpen(false);
      handleSelectEvent(selectedEvent.id);
    } catch (err) {
      setActionError(err.message || 'Failed to save session');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session? All registrations for this session will be removed.')) {
      return;
    }
    try {
      await api.deleteSession(sessionId);
      handleSelectEvent(selectedEvent.id);
    } catch (err) {
      alert(err.message || 'Failed to delete session');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-gray-100 via-gray-200 to-indigo-300 bg-clip-text text-transparent">
            Events & Sessions Directory
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage conference events, locations, sessions, and real seat capacities</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Include Archived Toggle */}
          <button
            onClick={() => setIncludeArchived(!includeArchived)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              includeArchived
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'glass-panel text-gray-400 border-gray-800 hover:text-gray-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>{includeArchived ? 'Showing Archived' : 'Show Archived'}</span>
          </button>

          {/* Create Event Button (ORGANIZER ONLY) */}
          {isOrganizer && (
            <button
              onClick={() => handleOpenEventModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Event Selector & Sessions Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Event List Cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Events ({events.length})</h3>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-500 glass-card rounded-2xl">No events found.</div>
          ) : (
            events.map((evt) => {
              const isSelected = selectedEvent?.id === evt.id;
              return (
                <div
                  key={evt.id}
                  onClick={() => handleSelectEvent(evt.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-2 border-indigo-500 shadow-lg shadow-indigo-500/10'
                      : 'glass-card border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {evt.is_archived === 1 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ARCHIVED
                          </span>
                        )}
                        <span className="text-xs text-indigo-400 font-semibold">{evt.session_count || 0} Sessions</span>
                      </div>
                      <h4 className="font-bold text-gray-100 mt-1">{evt.name}</h4>
                      <p className="text-xs text-gray-400 line-clamp-1 mt-1">{evt.description}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-500" />
                      <span className="truncate max-w-[140px]">{evt.venue}</span>
                    </div>

                    {isOrganizer && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenEventModal(evt)}
                          className="p-1 text-gray-400 hover:text-indigo-300 transition-colors"
                          title="Edit Event"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(evt)}
                          className="p-1 text-gray-400 hover:text-amber-300 transition-colors"
                          title={evt.is_archived ? 'Restore Event' : 'Archive Event'}
                        >
                          {evt.is_archived ? <RefreshCw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Sessions Panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedEvent ? (
            <div className="p-6 rounded-2xl glass-card border border-gray-800 space-y-6">
              
              {/* Event Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Event Sessions</span>
                    {selectedEvent.is_archived === 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        ARCHIVED
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-gray-100 mt-1">{selectedEvent.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">{selectedEvent.venue} ({selectedEvent.start_date} to {selectedEvent.end_date})</p>
                </div>

                {isOrganizer && (
                  <button
                    onClick={() => handleOpenSessionModal()}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Session</span>
                  </button>
                )}
              </div>

              {/* Sessions List */}
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <Calendar className="w-10 h-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm">No sessions created for this event yet.</p>
                  </div>
                ) : (
                  sessions.map((session) => {
                    const activeCount = session.active_registrations_count || 0;
                    const isFull = activeCount >= session.capacity;

                    return (
                      <div
                        key={session.id}
                        className="p-5 rounded-2xl bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-gray-100">{session.title}</h3>
                              {isFull && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  AT CAPACITY
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-2">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                {new Date(session.start_time).toLocaleString()} ({session.duration_mins} mins)
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                                {session.location}
                              </span>
                            </div>
                          </div>

                          {/* Organizer Actions */}
                          {isOrganizer && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleOpenSessionModal(session)}
                                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-xs flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Capacity Status Progress Bar */}
                        <div className="pt-2 border-t border-gray-800/60">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-400">Seat Capacity Progress</span>
                            <span className={`font-bold ${isFull ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {activeCount} / {session.capacity} Seats Filled
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${isFull ? 'bg-rose-500' : 'bg-indigo-500'}`}
                              style={{ width: `${Math.min(100, (activeCount / session.capacity) * 100)}%` }}
                            />
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          ) : (
            <div className="p-12 text-center text-gray-500 glass-card rounded-2xl">
              Select an event from the list to view its sessions.
            </div>
          )}
        </div>

      </div>

      {/* Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </h3>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveEvent} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="TechInnovate Summit 2026"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Overview of the conference..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Venue Location</label>
                <input
                  type="text"
                  required
                  value={eventForm.venue}
                  onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                  placeholder="Silicon Convention Center, Hall A"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              {editingSession ? 'Edit Session' : 'Add Session'}
            </h3>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveSession} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  placeholder="Keynote: Scalable Cloud Architecture"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={sessionForm.start_time}
                    onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    required
                    min={15}
                    value={sessionForm.duration_mins}
                    onChange={(e) => setSessionForm({ ...sessionForm, duration_mins: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Room / Location in Venue</label>
                <input
                  type="text"
                  required
                  value={sessionForm.location}
                  onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                  placeholder="Main Stage / Auditorium B"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">Seat Capacity (Real Max Seats)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={sessionForm.capacity}
                  onChange={(e) => setSessionForm({ ...sessionForm, capacity: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 bg-gray-800 hover:bg-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
