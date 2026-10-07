import { useEffect } from "react";
import { Link } from "react-router-dom";

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatShowDate(date) {
  return new Date(date).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatusLabel(status) {
  if (status === "paid") return "Confirmed";
  if (status === "pending_payment") return "Payment pending";
  if (status === "held") return "Hold active";
  return status || "Unknown";
}

function getStatusClasses(status) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  if (status === "pending_payment") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  }

  return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
}

function getBookingTimeline(booking) {
  if (booking.status === "paid" && booking.paidAt) {
    return `Paid on ${formatDateTime(booking.paidAt)}`;
  }

  if (booking.status === "pending_payment" && booking.holdExpiresAt) {
    return `Complete payment before ${formatDateTime(booking.holdExpiresAt)}`;
  }

  if (booking.status === "held" && booking.holdExpiresAt) {
    return `Seat hold ends at ${formatDateTime(booking.holdExpiresAt)}`;
  }

  if (booking.createdAt) {
    return `Created on ${formatDateTime(booking.createdAt)}`;
  }

  return "Booking details available";
}

export default function MovieBookingsDialog({
  open,
  bookings,
  loading,
  error,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-bookings-dialog-title"
      >
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),linear-gradient(135deg,_#081120,_#11284a_55%,_#173463)] px-6 py-5 text-white dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100">
                My Movie Bookings
              </div>
              <h2
                id="movie-bookings-dialog-title"
                className="mt-3 text-2xl font-black tracking-tight"
              >
                Your booked movie shows
              </h2>
              <p className="mt-2 text-sm text-slate-200">
                Review your confirmed tickets, payment-pending bookings, and
                active holds without leaving the movies page.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                {bookings.length} booking{bookings.length === 1 ? "" : "s"}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Loading your movie bookings...
            </div>
          ) : error ? (
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                No movie bookings yet
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Once you hold seats or complete payment, your bookings will
                appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const show = booking.show || {};

                return (
                  <article
                    key={booking._id}
                    className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="grid gap-4 p-4 md:grid-cols-[120px_1fr] md:p-5">
                      <img
                        src={show.posterUrl || "/placeholder.svg"}
                        alt={show.title || "Movie poster"}
                        className="h-40 w-full rounded-[1.25rem] object-cover md:h-full"
                      />

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                              {show.language || "Movie"} booking
                            </div>
                            <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                              {show.title || "Movie booking"}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {show.subtitle || `${show.venue || "Venue TBA"}, ${show.city || "City TBA"}`}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusClasses(booking.status)}`}
                          >
                            {formatStatusLabel(booking.status)}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Showtime
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {show.date ? formatShowDate(show.date) : "Schedule unavailable"}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Venue
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {show.venue && show.city
                                ? `${show.venue}, ${show.city}`
                                : "Venue unavailable"}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Amount
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(booking.amount, booking.currency)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Reference
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {booking.bookingReference}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Seats
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(booking.seats || []).map((seat) => (
                              <span
                                key={`${booking._id}-${seat.seatId}`}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              >
                                {seat.seatId} - {seat.section}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {getBookingTimeline(booking)}
                          </div>

                          {show._id ? (
                            <Link
                              to={`/tickets/${show._id}`}
                              onClick={onClose}
                              className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                            >
                              View booking
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
