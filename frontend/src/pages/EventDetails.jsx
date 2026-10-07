import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    setTimeout(() => setToast({ open: false, type: 'info', message: '' }), 5000);
  };

  useEffect(() => {
    void load();
  }, [id, user]);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [eventResponse, reviewResponse] = await Promise.all([
        axios.get(`/api/events/${id}`),
        axios.get(`/api/reviews/${id}`),
      ]);

      setEvent(eventResponse.data.event);
      setReviews(reviewResponse.data.reviews || []);

      if (user) {
        const userReview = reviewResponse.data.reviews?.find(
          (review) => review.user?._id === user.id,
        );
        setHasReviewed(!!userReview);
      } else {
        setHasReviewed(false);
      }
    } catch (error) {
      setEvent(null);
      setReviews([]);
      setHasReviewed(false);
      setError(error.response?.data?.message || 'Unable to load this event.');
    } finally {
      setLoading(false);
    }
  }

  function register() {
    if (event?.status !== 'approved') {
      showToast(
        'info',
        'This event is waiting for admin approval, so registration is disabled right now.',
      );
      return;
    }

    if (!user) {
      showToast('warning', 'Please log in to continue to booking.');
      navigate('/login');
      return;
    }

    navigate(`/events/${id}/booking`);
  }

  function shareEvent() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event.title, text: event.description, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Event link copied!');
    }
  }

  function downloadIcs() {
    const start = new Date(event.date);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//CampusEvents//EN\nBEGIN:VEVENT\nUID:${event._id}@campus\nDTSTAMP:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nDTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nDTEND:${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nSUMMARY:${event.title}\nDESCRIPTION:${event.description}\nLOCATION:${event.location}\nEND:VEVENT\nEND:VCALENDAR`;
    const url = URL.createObjectURL(
      new Blob([ics], { type: 'text/calendar;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${event.title}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submitReview() {
    if (event?.status !== 'approved') {
      showToast('info', 'Reviews can be posted only after the event is approved.');
      return;
    }

    try {
      await axios.post(`/api/reviews/${id}`, { rating, comment });
      showToast('success', 'Review posted successfully!');
      setComment('');
      await load();
    } catch (error) {
      if (error.response?.status === 401) {
        showToast('warning', 'Please log in to post a review.');
      } else if (error.response?.status === 400 && error.response?.data?.message?.includes('reviewed')) {
        showToast('info', 'You have already reviewed this event.');
      } else {
        showToast(
          'error',
          `Failed to post review: ${error.response?.data?.message || 'Please try again.'}`,
        );
      }
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading event details...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold">Event unavailable</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {error || 'This event could not be loaded.'}
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => navigate('/')}>
            Back to Home
          </button>
          <button className="btn-outline" onClick={() => navigate('/dashboard')}>
            Open Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast.open && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-white shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'warning'
                ? 'bg-yellow-600'
                : toast.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="font-semibold capitalize">{toast.type}</span>
            <span className="opacity-90">{toast.message}</span>
            <button
              className="ml-4 opacity-80 hover:opacity-100"
              onClick={() => setToast({ ...toast, open: false })}
            >
              x
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <img
          src={event.posterUrl || '/placeholder.svg'}
          alt={event.title}
          className="h-64 w-full rounded-xl object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          {event.status !== 'approved' ? (
            <div className="mt-3 inline-flex items-center gap-2">
              <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                Waiting for admin approval
              </div>
              {event.sentForApprovalAt ? (
                <div className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Sent</div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-slate-700 dark:text-slate-300">{event.description}</p>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {new Date(event.date).toLocaleString()} | {event.location}
          </div>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Permanent booking:{' '}
            {Number(event.permanentBookingPrice || 0) > 0
              ? formatCurrency(event.permanentBookingPrice, event.currency || 'INR')
              : 'Not available'}
          </div>
          {event.status !== 'approved' ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              This event is hidden from customers until an admin approves it.
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              className="btn"
              onClick={register}
              disabled={event.status !== 'approved'}
            >
              {event.status === 'approved' ? 'Register' : 'Registration Locked'}
            </button>
            <button className="btn-outline" onClick={shareEvent}>
              Share
            </button>
            <button className="btn-outline" onClick={downloadIcs}>
              Add to Calendar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">Reviews</h2>
        {user && !hasReviewed && event.status === 'approved' && (
          <div className="mb-3 flex items-center gap-2">
            <select
              className="input"
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              className="input flex-1"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Share your experience"
            />
            <button className="btn" onClick={submitReview} disabled={!comment.trim()}>
              Post
            </button>
          </div>
        )}

        {user && hasReviewed && (
          <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/30">
            <p className="text-sm text-green-800 dark:text-green-200">
              You have already reviewed this event.
            </p>
          </div>
        )}

        {event.status !== 'approved' ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Reviews open after approval, when the event becomes visible to customers.
          </div>
        ) : null}

        {reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No reviews yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li
                key={review._id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {review.user?.name} | {new Date(review.createdAt).toLocaleString()}
                </div>
                <div>Rating: {review.rating}</div>
                <p className="text-slate-700 dark:text-slate-200">{review.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
