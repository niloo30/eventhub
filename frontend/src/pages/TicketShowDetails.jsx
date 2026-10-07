import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';
import { SOCKET_URL } from '../config/network.js';
import { loadRazorpayCheckout } from '../utils/loadRazorpayCheckout.js';

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatShowDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatClock(date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDateKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRelativeTimer(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function dedupeShows(shows = []) {
  const map = new Map();

  for (const show of shows) {
    if (!show?._id) continue;
    map.set(show._id, show);
  }

  return [...map.values()];
}

function formatShowCountdown(dateValue, now) {
  const showTime = new Date(dateValue).getTime();
  if (Number.isNaN(showTime)) return 'Unavailable';

  const difference = showTime - now;
  if (difference <= 0) return 'Now live';
  if (difference < 60 * 60 * 1000) return `In ${Math.ceil(difference / (60 * 1000))} min`;

  const hours = Math.floor(difference / (60 * 60 * 1000));
  const minutes = Math.round((difference % (60 * 60 * 1000)) / (60 * 1000));

  if (difference < 24 * 60 * 60 * 1000) {
    return minutes > 0 ? `In ${hours}h ${minutes}m` : `In ${hours}h`;
  }

  return `${hours}h away`;
}

function buildDateStrip(shows, activeShowId, now) {
  const grouped = new Map();

  for (const show of [...shows].sort((left, right) => new Date(left.date) - new Date(right.date))) {
    const dateKey = getDateKey(show.date);
    if (!dateKey) continue;

    const currentGroup = grouped.get(dateKey) || {
      key: dateKey,
      date: show.date,
      shows: [],
    };

    currentGroup.shows.push(show);
    grouped.set(dateKey, currentGroup);
  }

  return [...grouped.values()].map((group) => {
    const active = group.shows.some((show) => show._id === activeShowId);
    const futureShows = group.shows.filter((show) => new Date(show.date).getTime() > now);

    return {
      key: group.key,
      day: new Date(group.date).toLocaleDateString('en-IN', { day: '2-digit' }),
      weekday: new Date(group.date).toLocaleDateString('en-IN', { weekday: 'short' }),
      month: new Date(group.date).toLocaleDateString('en-IN', { month: 'short' }),
      active,
      shows: group.shows,
      disabled: futureShows.length === 0 && !active,
      meta: futureShows.length > 0 ? `${futureShows.length} slot${futureShows.length === 1 ? '' : 's'}` : 'Closed',
    };
  });
}

function buildMomentStrip(shows, activeShowId, now) {
  return [...shows]
    .sort((left, right) => new Date(left.date) - new Date(right.date))
    .map((show) => {
      const showTime = new Date(show.date).getTime();

      return {
        key: show._id,
        showId: show._id,
        label: formatClock(show.date),
        active: show._id === activeShowId,
        disabled: showTime <= now && show._id !== activeShowId,
        meta: formatShowCountdown(show.date, now),
      };
    });
}

function buildShowMoments(dateValue, durationMinutes = 150) {
  const start = new Date(dateValue);
  if (Number.isNaN(start.getTime())) return [];

  const doors = new Date(start.getTime() - 30 * 60 * 1000);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return [
    { label: 'Doors', time: formatClock(doors), active: false },
    { label: 'Showtime', time: formatClock(start), active: true },
    { label: 'Ends', time: formatClock(end), active: false },
  ];
}

function pickPreferredShow(shows, now) {
  const orderedShows = [...shows].sort((left, right) => new Date(left.date) - new Date(right.date));
  return orderedShows.find((show) => new Date(show.date).getTime() > now) || orderedShows[0] || null;
}

function getPriceRangeLabel(show) {
  const pricing = show?.pricing;
  if (!pricing) return formatCurrency(0, show?.currency || 'INR');
  if (pricing.min === pricing.max) return formatCurrency(pricing.min, show.currency);
  return `${formatCurrency(pricing.min, show.currency)} - ${formatCurrency(pricing.max, show.currency)}`;
}

function compareRowLabels(left = '', right = '') {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
  });
}

function groupSeatsBySection(seats = []) {
  const sections = new Map();

  for (const seat of [...seats].sort((left, right) => {
    const rowComparison = compareRowLabels(left.row, right.row);
    if (rowComparison !== 0) return rowComparison;
    if (left.number !== right.number) return left.number - right.number;
    return String(left.section || '').localeCompare(String(right.section || ''));
  })) {
    const section = sections.get(seat.section) || {
      name: seat.section,
      price: seat.price,
      rowsMap: new Map(),
    };

    const rowSeats = section.rowsMap.get(seat.row) || [];
    rowSeats.push(seat);
    section.rowsMap.set(seat.row, rowSeats);
    sections.set(seat.section, section);
  }

  return [...sections.values()]
    .map((section) => {
      const rows = [...section.rowsMap.entries()]
        .sort(([leftRow], [rightRow]) => compareRowLabels(leftRow, rightRow))
        .map(([rowLabel, rowSeats]) => ({
          rowLabel,
          seats: rowSeats.sort((left, right) => left.number - right.number),
        }));

      return {
        name: section.name,
        price: section.price,
        rows,
      };
    })
    .sort((left, right) =>
      compareRowLabels(left.rows[0]?.rowLabel || '', right.rows[0]?.rowLabel || '')
    );
}

function buildSeatBreakdown(seats = []) {
  const sections = new Map();

  for (const seat of seats) {
    const current = sections.get(seat.section) || {
      section: seat.section,
      count: 0,
      subtotal: 0,
    };

    current.count += 1;
    current.subtotal += seat.price || 0;
    sections.set(seat.section, current);
  }

  return [...sections.values()];
}

function openRazorpayCheckout({ show, order, keyId, booking, user }) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay checkout is unavailable.'));
      return;
    }

    let settled = false;

    const razorpay = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'EventManager Movies',
      description: `${show.title} ticket booking`,
      order_id: order.id,
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
      },
      notes: {
        showTitle: show.title,
        bookingReference: booking.bookingReference,
      },
      theme: {
        color: '#10b981',
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          const error = new Error('Payment popup closed.');
          error.dismissed = true;
          reject(error);
        },
      },
      handler: (response) => {
        if (settled) return;
        settled = true;
        resolve(response);
      },
    });

    razorpay.on('payment.failed', (response) => {
      if (settled) return;
      settled = true;
      reject(new Error(response?.error?.description || 'Payment could not be completed.'));
    });

    razorpay.open();
  });
}

export default function TicketShowDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [show, setShow] = useState(null);
  const [relatedShows, setRelatedShows] = useState([]);
  const [seatSnapshot, setSeatSnapshot] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [paidBookings, setPaidBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });
  const [now, setNow] = useState(Date.now());
  const toastTimerRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast({ open: false, type: 'info', message: '' });
    }, 4000);
  };

  const loadShow = useCallback(async () => {
    const response = await axios.get(`/api/tickets/shows/${id}`);
    setShow(response.data.show);
    setSeatSnapshot(response.data.seatSnapshot);
    return response.data.show;
  }, [id]);

  const loadRelatedShows = useCallback(async (sourceShow) => {
    if (!sourceShow?.title || !sourceShow?.type) {
      setRelatedShows(sourceShow ? [sourceShow] : []);
      return;
    }

    const collectedShows = [sourceShow];

    try {
      const response = await axios.get('/api/tickets/shows', {
        params: {
          type: sourceShow.type,
          title: sourceShow.title,
          city: sourceShow.city,
          venue: sourceShow.venue,
        },
      });

      collectedShows.push(...(response.data.shows || []));
    } catch {
      setRelatedShows([sourceShow]);
    }

    if (dedupeShows(collectedShows).length < 3) {
      try {
        const fallbackResponse = await axios.get('/api/tickets/shows', {
          params: {
            type: sourceShow.type,
            title: sourceShow.title,
          },
        });

        collectedShows.push(...(fallbackResponse.data.shows || []));
      } catch {
        setRelatedShows(dedupeShows(collectedShows));
      }
    }

    setRelatedShows(
      dedupeShows(collectedShows).sort((left, right) => new Date(left.date) - new Date(right.date))
    );
  }, []);

  const loadMyBookings = useCallback(async () => {
    if (!user) {
      setActiveBooking(null);
      setPaidBookings([]);
      return;
    }

    const response = await axios.get('/api/tickets/my-bookings', {
      params: {
        showId: id,
        status: 'held,pending_payment,paid',
      },
    });

    const bookings = response.data.bookings || [];
    setActiveBooking(bookings.find((booking) => ['held', 'pending_payment'].includes(booking.status)) || null);
    setPaidBookings(bookings.filter((booking) => booking.status === 'paid'));
  }, [id, user]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      setRelatedShows([]);
      try {
        const nextShow = await loadShow();
        await Promise.all([loadMyBookings(), loadRelatedShows(nextShow)]);
      } catch (error) {
        if (mounted) {
          showToast('error', error.response?.data?.message || 'Unable to load this show.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [id, user, loadShow, loadMyBookings, loadRelatedShows]);

  useEffect(() => {
    if (!activeBooking) return;
    setSelectedSeatIds(activeBooking.seats.map((seat) => seat.seatId));
  }, [activeBooking]);

  useEffect(() => {
    if (!SOCKET_URL) return undefined;

    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.emit('tickets:join-show', id);
    socket.on('tickets:seat-map', (payload) => {
      if (payload.showId !== id) return;

      setSeatSnapshot({
        counters: payload.counters,
        seats: payload.seats,
      });

      setSelectedSeatIds((currentSelection) =>
        currentSelection.filter((seatId) => {
          const nextSeat = payload.seats.find((seat) => seat.seatId === seatId);
          return nextSeat && (nextSeat.status === 'available' || nextSeat.bookingId === activeBooking?._id);
        })
      );
    });

    return () => {
      socket.emit('tickets:leave-show', id);
      socket.close();
    };
  }, [id, activeBooking?._id]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      activeBooking?.holdExpiresAt ? 1000 : 30000
    );
    return () => window.clearInterval(timer);
  }, [activeBooking?.holdExpiresAt]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  const seatSections = useMemo(
    () => groupSeatsBySection(seatSnapshot?.seats || []),
    [seatSnapshot?.seats]
  );

  const selectedSeats = useMemo(() => {
    if (activeBooking?.seats?.length) return activeBooking.seats;

    const seatMap = new Map((seatSnapshot?.seats || []).map((seat) => [seat.seatId, seat]));
    return selectedSeatIds.map((seatId) => seatMap.get(seatId)).filter(Boolean);
  }, [activeBooking, seatSnapshot?.seats, selectedSeatIds]);

  const selectedBreakdown = useMemo(() => buildSeatBreakdown(selectedSeats), [selectedSeats]);
  const selectedAmount = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + (seat?.price || 0), 0),
    [selectedSeats]
  );

  const holdRemainingMs = activeBooking?.holdExpiresAt
    ? new Date(activeBooking.holdExpiresAt).getTime() - now
    : 0;
  const currentAmount = activeBooking?.amount || selectedAmount;
  const scheduleShows = useMemo(
    () =>
      dedupeShows([show, ...relatedShows].filter(Boolean)).sort(
        (left, right) => new Date(left.date) - new Date(right.date)
      ),
    [relatedShows, show]
  );
  const selectedDateKey = getDateKey(show?.date);
  const showsForSelectedDate = useMemo(
    () =>
      scheduleShows.filter((scheduleShow) => getDateKey(scheduleShow.date) === selectedDateKey),
    [scheduleShows, selectedDateKey]
  );
  const dateStrip = useMemo(
    () => buildDateStrip(scheduleShows, show?._id, now),
    [now, scheduleShows, show?._id]
  );
  const momentStrip = useMemo(
    () => buildMomentStrip(showsForSelectedDate, show?._id, now),
    [now, show?._id, showsForSelectedDate]
  );
  const selectedShowMoments = useMemo(
    () => buildShowMoments(show?.date, show?.durationMinutes),
    [show?.date, show?.durationMinutes]
  );

  async function refreshBookingState() {
    await Promise.all([loadShow(), loadMyBookings()]);
  }

  function navigateToShow(nextShowId) {
    if (!nextShowId || nextShowId === id) return;

    if (activeBooking) {
      showToast('info', 'Release your current hold or finish payment before changing the showtime.');
      return;
    }

    navigate(`/tickets/${nextShowId}`);
  }

  function handleDateSelect(dateKey) {
    const selectedDate = dateStrip.find((item) => item.key === dateKey);
    const preferredShow = pickPreferredShow(selectedDate?.shows || [], now);
    if (!preferredShow) return;
    navigateToShow(preferredShow._id);
  }

  function handleTimeSelect(showId) {
    navigateToShow(showId);
  }

  function handleSeatToggle(seat) {
    if (!user) {
      navigate('/login');
      return;
    }

    if (activeBooking) {
      showToast('info', 'Release your current hold before choosing a different set of seats.');
      return;
    }

    if (seat.status !== 'available') return;

    setSelectedSeatIds((current) =>
      current.includes(seat.seatId)
        ? current.filter((seatId) => seatId !== seat.seatId)
        : [...current, seat.seatId]
    );
  }

  async function holdSelectedSeats() {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedSeatIds.length) {
      showToast('info', 'Select at least one seat to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`/api/tickets/shows/${id}/hold`, {
        seatIds: selectedSeatIds,
      });

      setActiveBooking(response.data.booking);
      setSelectedSeatIds(response.data.booking.seats.map((seat) => seat.seatId));
      await loadShow();
      showToast('success', 'Seats held successfully. Complete payment before the timer ends.');
    } catch (error) {
      showToast(
        'error',
        error.response?.data?.message || 'Unable to hold the selected seats.'
      );
      await refreshBookingState();
    } finally {
      setSubmitting(false);
    }
  }

  async function releaseHold() {
    if (!activeBooking) return;

    setSubmitting(true);
    try {
      await axios.delete(`/api/tickets/bookings/${activeBooking._id}/hold`);
      setActiveBooking(null);
      setSelectedSeatIds([]);
      await refreshBookingState();
      showToast('success', 'Your held seats were released.');
    } catch (error) {
      showToast(
        'error',
        error.response?.data?.message || 'Unable to release the held seats.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function payForSeats() {
    if (!activeBooking) {
      showToast('info', 'Hold your seats before starting payment.');
      return;
    }

    setSubmitting(true);

    try {
      const scriptReady = await loadRazorpayCheckout();
      if (!scriptReady) {
        throw new Error('Unable to load Razorpay checkout right now.');
      }

      const orderResponse = await axios.post(
        `/api/tickets/bookings/${activeBooking._id}/create-order`
      );

      const paymentResult = await openRazorpayCheckout({
        show,
        keyId: orderResponse.data.keyId,
        order: orderResponse.data.order,
        booking: orderResponse.data.booking,
        user,
      });

      await axios.post(
        `/api/tickets/bookings/${activeBooking._id}/verify-payment`,
        paymentResult
      );

      setActiveBooking(null);
      setSelectedSeatIds([]);
      await refreshBookingState();
      showToast('success', 'Payment received. Your movie seats are confirmed.');
    } catch (error) {
      if (error.dismissed) {
        showToast('info', 'Payment was cancelled before completion.');
      } else {
        showToast(
          'error',
          error.response?.data?.message || error.message || 'Unable to complete payment.'
        );
      }

      await refreshBookingState();
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelPaidBooking(bookingId) {
    setCancellingBookingId(bookingId);
    try {
      await axios.post(`/api/tickets/bookings/${bookingId}/cancel`);
      showToast('success', 'Booking cancelled. Your refund has been credited to your wallet.');
      await refreshBookingState();
      await loadShow();
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Unable to cancel this booking.');
    } finally {
      setCancellingBookingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading movie hall...
      </div>
    );
  }

  if (!show || !seatSnapshot) {
    return (
      <div className="space-y-4">
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          We could not find this show.
        </div>
        <Link to="/movies" className="btn-outline">
          Back to movies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast.open ? (
        <div
          className={`fixed right-4 top-4 z-50 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-rose-600'
                : 'bg-slate-900'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link to="/movies" className="btn-outline">
            Back to movies
          </Link>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {show.venue}, {show.city}
          </div>
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
            {seatSnapshot.counters?.available || 0} seats available now
          </div>
        </div>

        {activeBooking ? (
          <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
            Hold timer: {formatRelativeTimer(holdRemainingMs)}
          </div>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_24%),linear-gradient(135deg,_#081120,_#0f1f2d_52%,_#14384b)] px-5 py-6 text-white md:px-8 md:py-8">
          <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
            <img
              src={show.posterUrl || '/placeholder.svg'}
              alt={show.title}
              className="h-[250px] w-[180px] rounded-[1.5rem] border border-white/10 object-cover shadow-2xl"
            />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
                  Movie ticketing
                </span>
                {(show.tags?.length ? show.tags : ['Cinema']).slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100"
                  >
                    {tag}
                  </span>
                ))}
                <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                  {show.language || 'Movie'}
                </span>
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                  {show.title}
                </h1>
                <p className="mt-2 text-sm text-slate-200 md:text-base">{show.subtitle}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Runtime</div>
                  <div className="mt-1 text-sm font-semibold">{show.durationMinutes} mins</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Ticket Range</div>
                  <div className="mt-1 text-sm font-semibold">{getPriceRangeLabel(show)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Hall</div>
                  <div className="mt-1 text-sm font-semibold">{show.venue}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">City</div>
                  <div className="mt-1 text-sm font-semibold">{show.city}</div>
                </div>
              </div>

              <p className="max-w-3xl text-sm leading-6 text-slate-300">{show.description}</p>

              <div className="grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Date</div>
                  <div className="flex flex-wrap gap-2">
                    {dateStrip.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleDateSelect(item.key)}
                        disabled={item.disabled}
                        className={`min-w-[68px] rounded-2xl border px-3 py-3 text-center ${
                          item.active
                            ? 'border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_12px_26px_-16px_rgba(52,211,153,0.85)]'
                            : item.disabled
                              ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500'
                              : 'border-white/10 bg-white/5 text-slate-300 transition hover:-translate-y-0.5 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">{item.weekday}</div>
                        <div className="mt-1 text-xl font-black">{item.day}</div>
                        <div className="text-[10px] uppercase tracking-[0.14em]">{item.month}</div>
                        <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-300/80">
                          {item.meta}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Time</div>
                  <div className="flex flex-wrap gap-2">
                    {momentStrip.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleTimeSelect(item.showId)}
                        disabled={item.disabled}
                        className={`rounded-2xl border px-4 py-3 text-left ${
                          item.active
                            ? 'border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_12px_26px_-16px_rgba(52,211,153,0.85)]'
                            : item.disabled
                              ? 'cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500'
                              : 'border-white/10 bg-white/5 text-slate-300 transition hover:-translate-y-0.5 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                          {item.active ? 'Selected' : 'Showtime'}
                        </div>
                        <div className="mt-1 text-sm font-bold">{item.label}</div>
                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/80">
                          {item.meta}
                        </div>
                      </button>
                    ))}
                    {momentStrip.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                        No other showtimes available for this date yet.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedShowMoments.map((item) => (
                      <div
                        key={`${item.label}-${item.time}`}
                        className={`rounded-2xl border px-4 py-3 ${
                          item.active
                            ? 'border-emerald-300/40 bg-emerald-400/20 text-white shadow-[0_12px_26px_-16px_rgba(52,211,153,0.85)]'
                            : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">{item.label}</div>
                        <div className="mt-1 text-sm font-bold">{item.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/8 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">Available</div>
                  <div className="mt-2 text-2xl font-black text-white">{seatSnapshot.counters?.available || 0}</div>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-amber-100">On hold</div>
                  <div className="mt-2 text-2xl font-black text-white">{seatSnapshot.counters?.held || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Booked</div>
                  <div className="mt-2 text-2xl font-black text-white">{seatSnapshot.counters?.booked || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="grid gap-6 border-t border-white/10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.1),_transparent_28%),linear-gradient(180deg,_#071019,_#0c1724)] px-5 py-6 text-white md:px-8 md:py-8 xl:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight">Choose your seats</h2>
              <p className="text-sm text-slate-300">
                Live availability updates instantly while other users book.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              {[
                { label: 'Closed', className: 'bg-slate-700/50 text-slate-400 border-slate-600' },
                { label: 'Available', className: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30' },
                { label: 'Reserved', className: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
                { label: 'Selected', className: 'bg-amber-400/15 text-amber-200 border-amber-300/40' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-full border px-3 py-1.5 ${item.className}`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] px-4 py-6 md:px-6">
            <div className="mb-10">
              <div className="mx-auto max-w-3xl">
                <div className="h-3 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-95" />
                <div className="mx-auto mt-2 h-px max-w-[88%] bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                <div className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.36em] text-slate-400">
                  Main Screen
                </div>
              </div>
            </div>

            <div className="space-y-7">
              {seatSections.map((section) => (
                <div key={section.name} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{section.name}</div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        {formatCurrency(section.price, show.currency)} per seat
                      </div>
                    </div>
                    <div className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                      {section.rows.length} rows
                    </div>
                  </div>

                  <div className="space-y-3">
                    {section.rows.map((row) => (
                      <div key={row.rowLabel} className="flex items-center gap-3 overflow-x-auto pb-1">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/5 text-xs font-bold text-slate-300">
                          {row.rowLabel}
                        </div>
                        <div className="flex min-w-max flex-wrap gap-2">
                          {row.seats.map((seat) => {
                            const isHeldByCurrentBooking =
                              Boolean(activeBooking) && seat.bookingId === activeBooking._id;
                            const isSelected =
                              selectedSeatIds.includes(seat.seatId) || isHeldByCurrentBooking;
                            const isDisabled =
                              seat.status !== 'available' && !isHeldByCurrentBooking;

                            let seatClassName = 'movie-seat movie-seat-available';

                            if (seat.status === 'booked') {
                              seatClassName = 'movie-seat movie-seat-booked';
                            } else if (isHeldByCurrentBooking) {
                              seatClassName = 'movie-seat movie-seat-active';
                            } else if (seat.status === 'held') {
                              seatClassName = 'movie-seat movie-seat-held';
                            } else if (isSelected) {
                              seatClassName = 'movie-seat movie-seat-selected';
                            }

                            return (
                              <button
                                key={seat.seatId}
                                type="button"
                                disabled={isDisabled || submitting}
                                title={`${seat.seatId} - ${formatCurrency(seat.price, show.currency)}`}
                                onClick={() => handleSeatToggle(seat)}
                                className={seatClassName}
                              >
                                <span>{seat.number}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-[2rem] border border-emerald-300/15 bg-[linear-gradient(180deg,_rgba(16,185,129,0.18),_rgba(15,23,42,0.96))] p-6 text-white shadow-[0_22px_48px_-26px_rgba(16,185,129,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/75">
                  Booking summary
                </div>
                <h2 className="mt-2 text-2xl font-black">
                  {selectedSeats.length} seat{selectedSeats.length === 1 ? '' : 's'}
                </h2>
                <p className="mt-2 text-sm text-emerald-50/80">{formatShowDate(show.date)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
                  Total
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatCurrency(currentAmount, activeBooking?.currency || show.currency)}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {selectedBreakdown.length > 0 ? (
                selectedBreakdown.map((item) => (
                  <div
                    key={item.section}
                    className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-white">{item.section}</div>
                      <div className="text-xs text-emerald-50/75">{item.count} seat(s)</div>
                    </div>
                    <div className="font-bold text-white">
                      {formatCurrency(item.subtotal, show.currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white/8 px-4 py-4 text-sm text-emerald-50/80">
                  Pick seats from the layout to see your live booking total.
                </div>
              )}
            </div>

            {selectedSeats.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedSeats.map((seat) => (
                  <div
                    key={seat.seatId}
                    className="rounded-lg bg-amber-300 px-2.5 py-1.5 text-xs font-black text-slate-900"
                  >
                    {seat.seatId} - {formatCurrency(seat.price, show.currency)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-emerald-50/75">
                No seats selected yet.
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-sm text-emerald-50/80">
              Seats are priced section-wise, just like a cinema booking site. Hold first, then finish payment to confirm them.
            </div>

            {!user ? (
              <div className="mt-6 space-y-3">
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  Login to continue
                </Link>
                <p className="text-center text-xs leading-5 text-emerald-50/75">
                  Sign in to hold seats and complete booking.
                </p>
              </div>
            ) : activeBooking ? (
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  <div className="font-semibold">Hold active</div>
                  <div className="mt-1">Reference: {activeBooking.bookingReference}</div>
                  <div className="mt-1">Time left: {formatRelativeTimer(holdRemainingMs)}</div>
                </div>

                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || holdRemainingMs <= 0}
                  onClick={payForSeats}
                >
                  {submitting
                    ? 'Preparing payment...'
                    : `Confirm and Pay ${formatCurrency(activeBooking.amount, activeBooking.currency)}`}
                </button>
                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/14 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  onClick={releaseHold}
                >
                  Release hold
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <button
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || selectedSeats.length === 0}
                  onClick={holdSelectedSeats}
                >
                  {submitting
                    ? 'Holding seats...'
                    : `Hold ${selectedSeats.length || 0} seat${selectedSeats.length === 1 ? '' : 's'}`}
                </button>
                <p className="text-center text-xs leading-5 text-emerald-50/75">
                  Once held, your seats stay reserved while you complete Razorpay checkout.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-white">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
              Pricing and show info
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              This page keeps the site theme intact while giving the booking flow a real cinema-style layout.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-white/6 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Showtime</div>
                <div className="mt-2 text-sm font-semibold text-white">{formatShowDate(show.date)}</div>
              </div>
              <div className="rounded-2xl bg-white/6 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Venue</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {show.venue}, {show.city}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {seatSections.map((section) => (
                <div
                  key={section.name}
                  className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-white">{section.name}</div>
                    <div className="text-xs text-slate-400">{section.rows.length} rows</div>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {formatCurrency(section.price, show.currency)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 text-white">
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
              Confirmed bookings
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Paid tickets for this show appear here after checkout succeeds.
            </p>

            {paidBookings.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-4 text-sm text-slate-300">
                No confirmed bookings for this show yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {paidBookings.map((booking) => (
                  <div key={booking._id} className="rounded-2xl bg-white/6 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{booking.bookingReference}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          Paid on{' '}
                          {booking.paidAt
                            ? new Date(booking.paidAt).toLocaleString('en-IN')
                            : 'just now'}
                        </div>
                      </div>
                      <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                        Paid
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {booking.seats.map((seat) => (
                        <div
                          key={seat.seatId}
                          className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold text-slate-100"
                        >
                          {seat.seatId} - {seat.section}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      Amount paid: {formatCurrency(booking.amount, booking.currency)}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => cancelPaidBooking(booking._id)}
                        disabled={cancellingBookingId === booking._id}
                        className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingBookingId === booking._id ? 'Cancelling...' : 'Cancel Ticket'}
                      </button>
                      {booking.refundReference ? (
                        <div className="rounded-2xl bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-200">
                          Refund ref: {booking.refundReference}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
      </section>
    </div>
  );
}
