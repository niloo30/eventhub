import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../../context/AuthContext.jsx';
import EventTicket from '../../components/EventTicket.jsx';
import DashboardHeader from '../../components/dashboard/DashboardHeader.jsx';
import DashboardStatCard from '../../components/dashboard/DashboardStatCard.jsx';
import DashboardToast from '../../components/dashboard/DashboardToast.jsx';

function getBookingLabel(bookingType) {
  return bookingType === 'permanent' ? 'Permanent Booking' : 'Free Registration';
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export default function CustomerDashboard() {
  const { user, logout, token } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [downloadAction, setDownloadAction] = useState(null);
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    setTimeout(() => setToast({ open: false, type: 'info', message: '' }), 3000);
  };

  function getRequestConfig() {
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  useEffect(() => {
    if (!user || !token) return;
    void loadDashboard();
  }, [token, user]);

  async function loadDashboard() {
    try {
      const [registrationRes, recommendationRes] = await Promise.all([
        axios.get('/api/registrations/me', getRequestConfig()),
        axios.get('/api/stats/recommendations', getRequestConfig()),
      ]);

      setRegistrations(registrationRes.data.registrations || []);
      setRecommendations(recommendationRes.data.events || []);
    } catch (error) {
      showToast('error', 'Unable to load your dashboard right now.');
    }
  }

  async function downloadTicketDirect(registration) {
    let tempDiv;

    try {
      tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '980px';
      tempDiv.style.padding = '20px';
      document.body.appendChild(tempDiv);

      const event = registration.event;
      const eventDate = new Date(event?.date);

      tempDiv.innerHTML = `
        <div style="width: 980px; padding: 20px;">
          <div style="display: flex; min-height: 360px; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <div style="flex: 1; padding: 32px; color: white; background: linear-gradient(135deg, #3730a3, #7c3aed, #3730a3);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                <div>
                  <div style="font-size: 14px; letter-spacing: 0.1em; color: #f0abfc;">EVENT MANAGER</div>
                  <div style="font-size: 12px; color: #c7d2fe;">Official Event Ticket</div>
                </div>
              </div>
              <div style="margin-bottom: 24px;">
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 0.025em;">${event?.title || ''}</div>
                <div style="color: #67e8f9; font-weight: 600; margin-top: 4px;">${event?.category || 'EVENT'}</div>
              </div>
              <div style="display: flex; align-items: end; gap: 32px; margin-bottom: 24px;">
                <div style="font-size: 30px; font-weight: 800; letter-spacing: 0.025em;">${eventDate.toLocaleDateString('en-GB')}</div>
                <div style="font-size: 30px; font-weight: 800; letter-spacing: 0.025em;">${eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style="text-transform: uppercase; letter-spacing: 0.1em; color: #67e8f9; margin-bottom: 24px;">${event?.location || ''}</div>
              <div style="display: flex; align-items: center;">
                <div style="height: 64px; width: 224px; background: repeating-linear-gradient(90deg, #fff 0, #fff 2px, transparent 2px, transparent 4px); border-radius: 4px;"></div>
              </div>
            </div>
            <div style="width: 2px; background: rgba(255,255,255,0.4); position: relative;">
              <div style="position: absolute; top: 24px; bottom: 24px; left: 0; right: 0; border-left: 2px dashed rgba(255,255,255,0.7);"></div>
            </div>
            <div style="width: 256px; padding: 24px; color: white; background: linear-gradient(to bottom, #312e81, #1e40af); display: flex; flex-direction: column;">
              <div style="color: #67e8f9; font-size: 16px; font-weight: 700; margin-bottom: 20px; writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 2px; text-shadow: 0 0 10px rgba(103, 232, 249, 0.5);">
                ${eventDate.getDate().toString().padStart(2, '0')} ${(eventDate.getMonth() + 1).toString().padStart(2, '0')} ${eventDate.getFullYear()} | ${eventDate.getHours().toString().padStart(2, '0')} ${eventDate.getMinutes().toString().padStart(2, '0')}
              </div>
              <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; margin-bottom: 16px; text-align: center;">
                <div style="color: #c7d2fe; font-size: 14px; margin-bottom: 8px;">ENTRY QR</div>
                ${registration.qrCodeDataUrl ? `<img src="${registration.qrCodeDataUrl}" alt="QR" style="margin: 0 auto; width: 144px; height: 144px; border-radius: 6px; background: white; padding: 4px;" />` : ''}
              </div>
              <div style="margin-top: auto; text-align: center; font-size: 10px; color: rgba(199, 210, 254, 0.8);">
                <div style="font-weight: 600;">EventManager</div>
                <div>2026 All rights reserved</div>
                <div style="opacity: 0.7;">www.eventmanager.com</div>
              </div>
            </div>
          </div>
        </div>
      `;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        padding: 20,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const x = margin;
      const y = margin + (contentHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`${event?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'ticket'}_ticket.pdf`);
      showToast('success', 'Ticket downloaded successfully.');
    } catch (error) {
      showToast('error', 'Unable to download your ticket.');
    } finally {
      if (tempDiv && document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
    }
  }

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = registrations.filter((registration) => {
      const eventDate = new Date(registration.event?.date).getTime();
      return Number.isFinite(eventDate) && eventDate >= now;
    }).length;

    return {
      total: registrations.length,
      upcoming,
      attended: registrations.filter((registration) => registration.status === 'attended').length,
      tickets: registrations.filter((registration) => Boolean(registration.qrCodeDataUrl)).length,
    };
  }, [registrations]);

  return (
    <div className="space-y-6">
      <DashboardToast toast={toast} />

      <DashboardHeader
        title="Your event hub"
        subtitle="Track registrations, open your ticket, and discover recommendations based on the events you already like."
        user={user}
        onLogout={logout}
        actions={
          <Link to="/pass" className="btn">
            View Passes
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard label="Registrations" value={stats.total} hint="All events you joined" />
        <DashboardStatCard label="Upcoming" value={stats.upcoming} hint="Events still ahead of you" />
        <DashboardStatCard label="Attended" value={stats.attended} hint="Checked in successfully" />
        <DashboardStatCard label="Tickets" value={stats.tickets} hint="Registrations with QR access" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">My Registrations</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Everything you have booked is listed here.</p>
          </div>
          <button className="btn-outline" onClick={loadDashboard}>
            Refresh
          </button>
        </div>

        {registrations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No registrations found yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {registrations.map((registration) => (
              <div key={registration._id} className="rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{registration.event?.title}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(registration.event?.date).toLocaleDateString()} | {registration.event?.location}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Status:{' '}
                      <span className={registration.status === 'registered' ? 'font-medium text-green-600' : 'font-medium text-yellow-600'}>
                        {registration.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Booking: <span className="font-medium text-slate-700 dark:text-slate-200">{getBookingLabel(registration.bookingType || 'free')}</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Reference: <span className="font-medium text-slate-700 dark:text-slate-200">{registration.bookingReference || 'Assigned automatically'}</span>
                    </div>
                    {Number(registration.amount || 0) > 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Paid:{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {formatCurrency(registration.amount, registration.currency || 'INR')}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {registration.qrCodeDataUrl ? (
                      <img src={registration.qrCodeDataUrl} className="h-16 w-16 rounded-lg border" alt="QR Code" />
                    ) : null}
                    <button className="btn-outline" onClick={() => setSelectedTicket(registration)}>
                      View Ticket
                    </button>
                    <button className="btn" onClick={() => downloadTicketDirect(registration)}>
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Recommended for You</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Suggestions based on your past event interests.</p>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Recommendations will appear after you register for a few events.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((event) => (
              <Link
                key={event._id}
                to={`/events/${event._id}`}
                className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{event.category}</div>
                <div className="mt-2 text-lg font-semibold">{event.title}</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(event.date).toLocaleDateString()} | {event.location}
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-950">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold">Event Ticket</h3>
                <div className="flex items-center gap-2">
                  <button className="btn" onClick={() => downloadAction && downloadAction()}>
                    Download Ticket
                  </button>
                  <button className="btn-outline" onClick={() => setSelectedTicket(null)}>
                    Close
                  </button>
                </div>
              </div>
              <EventTicket registration={selectedTicket} user={user} onReady={(fn) => setDownloadAction(() => fn)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
