import { useEffect, useState } from "react";
import axios from "axios";

function getBookingLabel(bookingType) {
  return bookingType === "permanent" ? "Permanent Booking" : "Free Registration";
}

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function getCancelEndpoint(registration) {
  return registration.type === "movie"
    ? `/api/tickets/bookings/${registration._id}/cancel`
    : `/api/registrations/bookings/${registration._id}/cancel`;
}

export default function Pass() {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  async function loadPasses() {
    setLoading(true);
    setError("");

    try {
      const [eventsRes, ticketsRes] = await Promise.allSettled([
        axios.get("/api/registrations/me"),
        axios.get("/api/tickets/my-bookings"),
      ]);

      const registrations =
        eventsRes.status === "fulfilled" ? eventsRes.value.data.registrations || [] : [];

      const bookings =
        ticketsRes.status === "fulfilled" ? ticketsRes.value.data.bookings || [] : [];

      const normalizedBookings = bookings.map((booking) => ({
        _id: booking._id,
        type: "movie",
        title: booking.show?.title,
        date: booking.show?.date,
        location: booking.show?.venue || booking.show?.city,
        bookingType: "permanent",
        bookingReference: booking.bookingReference,
        amount: booking.amount,
        currency: booking.currency,
        seats: booking.seats,
        status: booking.status,
        refundAmount: booking.refundAmount || 0,
        refundStatus: booking.refundStatus || "none",
        refundReference: booking.refundReference || null,
        refundedAt: booking.refundedAt || null,
        qrCodeDataUrl: booking.qrCodeDataUrl,
        posterUrl: booking.show?.posterUrl || booking.posterUrl || null,
        createdAt: booking.createdAt,
      }));

      const normalizedRegs = registrations.map((registration) => ({
        _id: registration._id,
        type: "event",
        title: registration.event?.title,
        date: registration.event?.date,
        location: registration.event?.location,
        bookingType: registration.bookingType,
        bookingReference: registration.bookingReference,
        amount: registration.amount,
        currency: registration.currency,
        status: registration.status,
        refundAmount: registration.refundAmount || 0,
        refundStatus: registration.refundStatus || "none",
        refundReference: registration.refundReference || null,
        refundedAt: registration.refundedAt || null,
        qrCodeDataUrl: registration.qrCodeDataUrl,
        posterUrl: registration.event?.posterUrl || null,
        createdAt: registration.createdAt,
      }));

      setRegs([...normalizedRegs, ...normalizedBookings]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load your passes right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPasses();
  }, []);

  async function handleCancel(registration) {
    setCancellingId(registration._id);
    setNotice("");
    setError("");

    try {
      await axios.post(getCancelEndpoint(registration));
      setNotice(
        registration.amount > 0
          ? "Cancellation completed. Your refund has been credited to your wallet."
          : "Cancellation completed."
      );
      await loadPasses();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to cancel this pass right now.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">My Passes</h1>
        <p className="text-sm text-slate-600">
          Review your event passes and movie tickets, then cancel any active booking if needed.
        </p>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          Loading passes...
        </div>
      ) : regs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          No passes found yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {regs.map((registration) => {
            const cancellable = registration.status !== "cancelled";

            return (
              <div key={registration._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {registration.type === "event" ? "Event pass" : "Movie ticket"}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">
                      {registration.title || "Unnamed booking"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {registration.date ? new Date(registration.date).toLocaleString("en-IN") : "Date TBD"}{" "}
                      | {registration.location || "Location TBD"}
                    </div>
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      registration.status === "cancelled"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {registration.status === "cancelled" ? "Cancelled" : "Active"}
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  {registration.type === "event"
                    ? getBookingLabel(registration.bookingType || "free")
                    : "Movie Ticket"}
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Reference: <span className="font-medium text-slate-900">{registration.bookingReference || "Assigned automatically"}</span>
                </div>

                {registration.amount ? (
                  <div className="mt-2 text-sm text-slate-600">
                    Paid: <span className="font-medium text-slate-900">{formatCurrency(registration.amount, registration.currency || "INR")}</span>
                  </div>
                ) : null}

                {registration.status === "cancelled" ? (
                  <div className="mt-2 text-sm text-slate-600">
                    Refund:{" "}
                    <span className="font-medium text-slate-900">
                      {registration.refundAmount > 0
                        ? `${formatCurrency(registration.refundAmount, registration.currency || "INR")} credited to your wallet`
                        : "No payment refund was due"}
                    </span>
                  </div>
                ) : null}

                {registration.seats && registration.seats.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {registration.seats.map((seat) => (
                      <span
                        key={seat.seatId || `${seat.row}${seat.number}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {seat.seatId || `${seat.row}${seat.number}`} {seat.section ? `- ${seat.section}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  {cancellable ? (
                    <button
                      type="button"
                      onClick={() => handleCancel(registration)}
                      disabled={cancellingId === registration._id}
                      className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancellingId === registration._id
                        ? "Cancelling..."
                        : registration.amount > 0
                          ? "Cancel & Refund"
                          : "Cancel Pass"}
                    </button>
                  ) : (
                    <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600">
                      This pass has already been cancelled.
                    </div>
                  )}

                  {registration.refundReference ? (
                    <div className="rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                      Refund ref: {registration.refundReference}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex gap-3 items-start">
                  {registration.posterUrl ? (
                    <img
                      src={registration.posterUrl}
                      alt="Poster"
                      className="h-32 w-24 rounded-2xl object-cover"
                    />
                  ) : null}

                  {registration.qrCodeDataUrl ? (
                    <img
                      src={registration.qrCodeDataUrl}
                      alt="QR"
                      className="h-32 rounded-2xl border border-slate-200 bg-white p-2"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
