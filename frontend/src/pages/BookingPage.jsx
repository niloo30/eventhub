import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";
import { loadRazorpayCheckout } from "../utils/loadRazorpayCheckout.js";

function getBookingLabel(bookingType) {
  return bookingType === "permanent"
    ? "Permanent Booking"
    : "Free Registration";
}

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function normalizeTicketOptionKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function openRazorpayCheckout({ event, order, keyId, registration, user }) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay checkout is unavailable."));
      return;
    }

    let settled = false;

    const razorpay = new window.Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: "EventManager",
      description: `Permanent booking for ${event.title}`,
      order_id: order.id,
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
      },
      notes: {
        eventTitle: event.title,
        bookingReference: registration.bookingReference,
      },
      theme: {
        color: "#2563eb",
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          const error = new Error("Payment popup closed.");
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

    razorpay.on("payment.failed", (response) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          response?.error?.description || "Payment could not be completed.",
        ),
      );
    });

    razorpay.open();
  });
}

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selectedOption, setSelectedOption] = useState("permanent");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    setTimeout(
      () => setToast({ open: false, type: "info", message: "" }),
      4500,
    );
  };

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    void loadEvent();
  }, [id, user]);

  async function loadEvent() {
    setLoading(true);
    setPageError("");

    try {
      const response = await axios.get(`/api/events/${id}`);
      const nextEvent = response.data.event;
      setEvent(nextEvent);

      const configuredOptions = Array.isArray(nextEvent?.ticketOptions)
        ? nextEvent.ticketOptions.filter((option) => option?.active !== false && option?.label)
        : [];

      if (configuredOptions.length > 0) {
        const featuredOption =
          configuredOptions.find((option) => option?.featured) || configuredOptions[0];
        setSelectedOption(normalizeTicketOptionKey(featuredOption?.key || featuredOption?.label));
      } else {
        const paidEnabled = Number(nextEvent?.permanentBookingPrice || 0) > 0;
        setSelectedOption(paidEnabled ? "permanent" : "free");
      }
    } catch (error) {
      const message =
        error.response?.data?.message || "Unable to load booking details.";
      setEvent(null);
      setPageError(message);
      showToast("error", message);
    } finally {
      setLoading(false);
    }
  }

  const permanentBookingPrice = Number(event?.permanentBookingPrice || 0);
  const isPermanentBookingAvailable = permanentBookingPrice > 0;
  const isEventApproved = event?.status === "approved";
  const bookingOptions = useMemo(
    () => {
      const configuredOptions = Array.isArray(event?.ticketOptions)
        ? event.ticketOptions
            .filter((option) => option?.active !== false && option?.label)
            .map((option) => {
              const key = normalizeTicketOptionKey(option?.key || option?.label);
              const availability = event?.ticketAvailability?.[key] || {};
              const price = Number(option?.price || 0);
              return {
                id: key,
                title: option.label,
                description:
                  option.description ||
                  (price > 0
                    ? "Secure your spot with payment and receive a permanent booking reference."
                    : "Complete registration instantly and receive an email confirmation."),
                badge: option.featured ? "Featured Ticket" : price > 0 ? "Paid Ticket" : "Free Ticket",
                disabled:
                  (Number.isFinite(availability.remaining) && availability.remaining === 0) ||
                  (!isEventApproved && price > 0),
                price,
                priceLabel:
                  price > 0 ? formatCurrency(price, event?.currency || "INR") : "Free",
                remaining:
                  Number.isFinite(availability.remaining) || availability.remaining === 0
                    ? availability.remaining
                    : null,
              };
            })
        : [];

      if (configuredOptions.length > 0) {
        return configuredOptions;
      }

      return [
        {
          id: "permanent",
          title: "Permanent Booking",
          description: isPermanentBookingAvailable
            ? `Secure your seat through Razorpay and receive a paid booking confirmation with a permanent reference.`
            : "Permanent booking is currently unavailable for this event.",
          badge: isPermanentBookingAvailable ? "Secure Payment" : "Unavailable",
          disabled: !isPermanentBookingAvailable,
          price: permanentBookingPrice,
          priceLabel: isPermanentBookingAvailable
            ? formatCurrency(permanentBookingPrice, event?.currency || "INR")
            : "Not enabled",
          remaining: Number(event?.capacity || 0) > 0 ? Number(event.capacity || 0) : null,
        },
        {
          id: "free",
          title: "Free Registration",
          description:
            "Complete the quick free registration flow and receive an email confirmation right away.",
          badge: "Quick Access",
          disabled: false,
          price: 0,
          priceLabel: "Free",
          remaining: Number(event?.capacity || 0) > 0 ? Number(event.capacity || 0) : null,
        },
      ];
    },
    [event, isEventApproved, isPermanentBookingAvailable, permanentBookingPrice],
  );

  const selectedDetails =
    bookingOptions.find((option) => option.id === selectedOption) ||
    bookingOptions[0];

  async function confirmFreeRegistration(ticketOptionKey) {
    await axios.post(`/api/registrations/${id}/register`, {
      ticketOptionKey,
    });
  }

  async function confirmPaidBooking(ticketOptionKey) {
    const scriptReady = await loadRazorpayCheckout();
    if (!scriptReady) {
      throw new Error("Unable to load Razorpay checkout right now.");
    }

    const createOrderResponse = await axios.post(
      `/api/registrations/${id}/create-order`,
      { ticketOptionKey },
    );
    const { keyId, order, registration } = createOrderResponse.data;
    const paymentResult = await openRazorpayCheckout({
      event,
      keyId,
      order,
      registration,
      user,
    });

    await axios.post(
      `/api/registrations/bookings/${registration._id}/verify-payment`,
      paymentResult,
    );
  }

  async function confirmBooking() {
    if (!event) return;
    if (!isEventApproved) {
      showToast(
        "info",
        "This event is waiting for admin approval, so bookings are not open yet.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const selectedOptionData =
        bookingOptions.find((option) => option.id === selectedOption) ||
        bookingOptions[0];
      if (!selectedOptionData) {
        throw new Error("No ticket option is available for this event.");
      }

      if (selectedOptionData.price > 0) {
        await confirmPaidBooking(selectedOptionData.id);
        showToast(
          "success",
          `Payment received. ${selectedOptionData.title} completed successfully.`,
        );
      } else {
        await confirmFreeRegistration(selectedOptionData.id);
        showToast(
          "success",
          `${selectedOptionData.title} completed. Check your email for confirmation.`,
        );
      }

      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (error) {
      if (error?.dismissed) {
        showToast("info", "Payment was cancelled before completion.");
      } else if (error.response?.status === 409) {
        showToast(
          "info",
          error.response?.data?.message ||
            "You are already registered for this event.",
        );
      } else {
        showToast(
          "error",
          error.response?.data?.message ||
            error.message ||
            "Unable to complete the booking right now.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading booking page...
      </div>
    );
  }

  if (pageError || !event) {
    return (
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold">Booking unavailable</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {pageError || "This booking page is not available right now."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => navigate("/")}>
            Back to Home
          </button>
          <button className="btn-outline" onClick={() => navigate("/dashboard")}>
            Open Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast.open ? (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-white shadow-lg ${
            toast.type === "success"
              ? "bg-green-600"
              : toast.type === "error"
                ? "bg-red-600"
                : "bg-blue-600"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Booking Page
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              Choose Your Registration Type
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Free registration stays instant. Paid tickets use Razorpay for secure payment before the pass is issued.
            </p>
            {!isEventApproved ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                This event is still waiting for admin approval. Customers can book only after approval.
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {bookingOptions.map((option) => {
              const isSelected = selectedOption === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    !option.disabled && setSelectedOption(option.id)
                  }
                  disabled={option.disabled || submitting || !isEventApproved}
                  className={`rounded-3xl border p-5 text-left transition ${
                    option.disabled || !isEventApproved
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-950"
                      : isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/30"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      {option.badge}
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {option.priceLabel}
                    </div>
                  </div>
                  <div className="mt-3 text-xl font-bold">{option.title}</div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {option.description}
                  </p>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {option.remaining === null
                      ? "Unlimited seats"
                      : `${option.remaining} seat${option.remaining === 1 ? "" : "s"} left`}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDetails.title}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {selectedDetails.description}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm dark:bg-slate-900">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Ticket price
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedDetails.priceLabel}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="btn"
                onClick={confirmBooking}
                disabled={submitting || !isEventApproved}
              >
                {!isEventApproved
                  ? "Waiting for Approval"
                  : submitting
                  ? selectedDetails.price > 0
                    ? "Opening payment..."
                    : "Processing..."
                  : selectedDetails.price > 0
                    ? `Pay ${selectedDetails.priceLabel}`
                    : `Confirm ${selectedDetails.title}`}
              </button>
              <button
                className="btn-outline"
                onClick={() => navigate(`/events/${id}`)}
                disabled={submitting}
              >
                Back to Event
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Event Summary
          </div>
          <h2 className="mt-3 text-2xl font-bold">{event.title}</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {event.description}
          </p>

          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-semibold">Date and time</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                {new Date(event.date).toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-semibold">Location</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                {event.location}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-semibold">Category</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                {event.category}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-semibold">Permanent booking</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                {isPermanentBookingAvailable
                  ? formatCurrency(
                      permanentBookingPrice,
                      event.currency || "INR",
                    )
                  : "Not available for this event"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-semibold">Event capacity</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                {Number(event?.capacity || 0) > 0
                  ? `${event.capacity} seats`
                  : "Unlimited / not set"}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950 px-4 py-4 text-sm text-slate-100 dark:bg-slate-800">
            {isEventApproved
              ? "Free registration sends confirmation immediately. Permanent booking generates the pass only after payment verification."
              : "This event is in the admin approval queue. Booking buttons will unlock after approval."}
          </div>
        </div>
      </div>
    </div>
  );
}
