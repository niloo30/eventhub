import crypto from 'crypto';
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import TicketBooking from '../models/TicketBooking.js';
import TicketSeatReservation from '../models/TicketSeatReservation.js';
import { env } from '../config/env.js';
import { ensureTicketShowsSeeded } from '../services/ticketCatalog.js';
import { searchShows } from '../services/search.js';
import { captureRazorpayPayment, createRazorpayOrder, fetchRazorpayPayment, verifyRazorpaySignature } from '../services/razorpay.js';
import {
  broadcastTicketSeatState,
  buildSeatSnapshot,
  cancelActiveBookingsForUser,
  cleanupExpiredTicketHolds,
  getTicketShowSeatState,
  findHydratedTicketShowById,
  generateTicketBookingReference,
  getTicketHoldDurationMs,
  hydrateTicketShows,
  invalidateShowCache,
  listHydratedTicketShows,
  mapTicketShowSummary,
  lockSeats,
  releaseSeats,
} from '../services/ticketing.js';
import { emailQueue, reminderQueue } from '../queues/index.js';
import { storeUploadedImage } from '../utils/upload.js';

function formatBooking(bookingDoc, showDoc = null) {
  const booking = bookingDoc.toObject ? bookingDoc.toObject() : bookingDoc;
  const show = showDoc ? (showDoc.toObject ? showDoc.toObject() : showDoc) : booking.show;

  return {
    _id: booking._id,
    show,
    seats: booking.seats,
    amount: booking.amount,
    currency: booking.currency,
    status: booking.status,
    holdExpiresAt: booking.holdExpiresAt,
    bookingReference: booking.bookingReference,
    razorpayOrderId: booking.razorpayOrderId,
    razorpayPaymentId: booking.razorpayPaymentId,
    paidAt: booking.paidAt,
    refundAmount: booking.refundAmount || 0,
    refundStatus: booking.refundStatus || 'none',
    refundReference: booking.refundReference || null,
    refundedAt: booking.refundedAt || null,
    createdAt: booking.createdAt,
  };
}

function buildTicketEmail(user, booking, show) {
  const seatList = booking.seats.map((seat) => `${seat.seatId} (${seat.section})`).join(', ');
  const formattedDate = new Date(show.date).toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const showUrl = `${env.clientUrl.replace(/\/$/, '')}/tickets/${show._id}`;

  return {
    subject: `Ticket confirmed: ${show.title}`,
    text: [
      `Hi ${user.name || 'there'},`,
      '',
      `Your ticket booking for ${show.title} is confirmed.`,
      `Booking reference: ${booking.bookingReference}`,
      `Seats: ${seatList}`,
      `Venue: ${show.venue}, ${show.city}`,
      `Date: ${formattedDate}`,
      `Amount paid: ${booking.currency} ${booking.amount}`,
      `View booking: ${showUrl}`,
      '',
      'Enjoy the show.',
      '',
      'EventManager Tickets',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Ticket Confirmed</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${show.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${user.name || 'there'}, your seats are confirmed and payment has been received.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${booking.bookingReference}</div>
            <div style="margin-bottom: 8px;"><strong>Seats:</strong> ${seatList}</div>
            <div style="margin-bottom: 8px;"><strong>Venue:</strong> ${show.venue}, ${show.city}</div>
            <div style="margin-bottom: 8px;"><strong>Date:</strong> ${formattedDate}</div>
            <div><strong>Amount:</strong> ${booking.currency} ${booking.amount}</div>
          </div>

          <a href="${showUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            View Ticket Booking
          </a>
        </div>
      </div>
    `,
  };
}

function buildTicketCancellationEmail(user, booking, show, refundAmount) {
  const seatList = booking.seats.map((seat) => `${seat.seatId} (${seat.section})`).join(', ');
  const showUrl = `${env.clientUrl.replace(/\/$/, '')}/tickets/${show._id}`;

  return {
    subject: `Ticket cancelled: ${show.title}`,
    text: [
      `Hi ${user.name || 'there'},`,
      '',
      `Your ticket booking for ${show.title} has been cancelled.`,
      `Booking reference: ${booking.bookingReference}`,
      `Seats: ${seatList}`,
      refundAmount > 0
        ? `Refund credited: ${formatCurrency(refundAmount, booking.currency)}`
        : 'Refund credited: No payment refund was due for this cancellation.',
      `Refund reference: ${booking.refundReference || 'Generated automatically'}`,
      `View booking: ${showUrl}`,
      '',
      'EventManager Tickets',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Ticket Cancelled</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${show.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${user.name || 'there'}, your ticket booking has been cancelled successfully.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${booking.bookingReference}</div>
            <div style="margin-bottom: 8px;"><strong>Seats:</strong> ${seatList}</div>
            <div style="margin-bottom: 8px;"><strong>${refundAmount > 0 ? 'Refund credited' : 'Refund status'}:</strong> ${refundAmount > 0 ? formatCurrency(refundAmount, booking.currency) : 'No payment refund was due'}</div>
            <div><strong>Refund reference:</strong> ${booking.refundReference || 'Generated automatically'}</div>
          </div>

          <a href="${showUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            Open Booking
          </a>
          <p style="margin: 24px 0 0; font-size: 14px; color: #475569;">${refundAmount > 0 ? 'The refund has been credited to your account wallet.' : 'This cancellation did not require a payment refund.'}</p>
        </div>
      </div>
    `,
  };
}

function normalizeCurrency(currency) {
  return (currency || 'INR').toUpperCase();
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function generateRefundReference(prefix = 'TKT') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function verifyRazorpayWebhookSignature(rawBody = '', signature = '') {
  if (!env.razorpayWebhookSecret) return false;
  const expectedSignature = crypto
    .createHmac('sha256', env.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');

  return expectedSignature === signature;
}

function extractWebhookPaymentDetails(payload = {}) {
  const paymentEntity = payload?.payload?.payment?.entity || null;
  const orderEntity = payload?.payload?.order?.entity || null;

  return {
    event: payload?.event || '',
    paymentId: paymentEntity?.id || null,
    orderId: paymentEntity?.order_id || orderEntity?.id || null,
    amount: paymentEntity?.amount ?? orderEntity?.amount ?? null,
    currency: paymentEntity?.currency || orderEntity?.currency || null,
    status: paymentEntity?.status || orderEntity?.status || null,
  };
}

async function finalizeTicketBookingPayment({
  booking,
  show = null,
  paymentId,
  signature,
  payment = null,
  user = null,
}) {
  const currentBooking = booking?._id
    ? await TicketBooking.findById(booking._id)
    : null;

  if (!currentBooking) {
    throw createHttpError(404, 'Booking not found');
  }

  const hydratedShow = show || (await findHydratedTicketShowById(currentBooking.show));
  if (!hydratedShow) {
    throw createHttpError(404, 'Ticket show not found');
  }

  if (currentBooking.status === 'paid') {
    return {
      alreadyPaid: true,
      booking: formatBooking(currentBooking, hydratedShow),
      show: hydratedShow,
      payment: payment || null,
    };
  }

  if (!['held', 'pending_payment'].includes(currentBooking.status)) {
    throw createHttpError(
      400,
      'This booking is no longer active. Please select your seats again.',
    );
  }

  if (!currentBooking.razorpayOrderId) {
    throw createHttpError(400, 'Payment order not found');
  }

  if (!paymentId) {
    throw createHttpError(400, 'Payment id is required');
  }

  let paymentRecord = payment || (await fetchRazorpayPayment(paymentId));
  if (
    paymentRecord?.status === 'authorized' &&
    !paymentRecord.captured
  ) {
    paymentRecord = await captureRazorpayPayment(
      paymentId,
      paymentRecord.amount,
      paymentRecord.currency,
    );
  }

  if (!['authorized', 'captured'].includes(paymentRecord.status)) {
    throw createHttpError(
      400,
      `Payment not completed. Current status: ${paymentRecord.status}`,
    );
  }

  const expectedAmount = Math.round((currentBooking.amount || 0) * 100);
  if (
    paymentRecord.amount !== expectedAmount ||
    normalizeCurrency(paymentRecord.currency) !==
      normalizeCurrency(currentBooking.currency)
  ) {
    throw createHttpError(400, 'Payment amount verification failed');
  }

  const updatedBooking = await TicketBooking.findOneAndUpdate(
    { _id: currentBooking._id, status: { $in: ['held', 'pending_payment'] } },
    {
      $set: {
        status: 'paid',
        razorpayPaymentId: paymentId,
        razorpaySignature: signature || currentBooking.razorpaySignature,
        paidAt: new Date(),
        refundAmount: 0,
        refundStatus: 'none',
      },
      $unset: {
        holdExpiresAt: 1,
        refundReference: 1,
        refundedAt: 1,
      },
    },
    { new: true },
  );

  const persistedBooking =
    updatedBooking || (await TicketBooking.findById(currentBooking._id));
  if (!persistedBooking) {
    throw createHttpError(404, 'Booking not found');
  }

  if (persistedBooking.status === 'paid' && !updatedBooking) {
    return {
      alreadyPaid: true,
      booking: formatBooking(persistedBooking, hydratedShow),
      show: hydratedShow,
      payment: paymentRecord,
    };
  }

  await TicketSeatReservation.updateMany(
    { booking: persistedBooking._id },
    { status: 'booked', holdExpiresAt: null },
  );
  await releaseSeats(
    persistedBooking.show,
    persistedBooking.seats.map((seat) => seat.seatId),
    persistedBooking.bookingReference || String(persistedBooking._id),
  );
  await invalidateShowCache(persistedBooking.show);

  const bookingUser =
    user?.email
      ? user
      : await User.findById(persistedBooking.user)
        .select('name email')
        .lean();

  try {
    if (bookingUser?.email) {
      const emailContent = buildTicketEmail(
        bookingUser,
        persistedBooking,
        hydratedShow,
      );
      void emailQueue.add(
        { to: bookingUser.email, ...emailContent },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    }
  } catch (emailErr) {
    console.error(
      `Failed to send ticket email to ${bookingUser?.email}: ${emailErr.message}`,
    );
  }

  const showDate = new Date(hydratedShow.date);
  const msTo24h = showDate.getTime() - Date.now() - 24 * 60 * 60 * 1000;
  const msTo2h = showDate.getTime() - Date.now() - 2 * 60 * 60 * 1000;

  if (msTo24h > 0) {
    void reminderQueue.add(
      { bookingId: persistedBooking._id, type: '24h' },
      { delay: msTo24h },
    );
  }

  if (msTo2h > 0) {
    void reminderQueue.add(
      { bookingId: persistedBooking._id, type: '2h' },
      { delay: msTo2h },
    );
  }

  await broadcastTicketSeatState(persistedBooking.show);

  return {
    booking: formatBooking(persistedBooking, hydratedShow),
    show: hydratedShow,
    payment: paymentRecord,
    alreadyPaid: false,
  };
}

function matchesTicketShowFilters(show, filters) {
  const {
    titleFilter,
    cityFilter,
    venueFilter,
    start,
    end,
    queryText,
    useElasticResults,
  } = filters;

  if (titleFilter && show.title?.toLowerCase() !== titleFilter) return false;
  if (cityFilter && show.city?.toLowerCase() !== cityFilter) return false;
  if (venueFilter && show.venue?.toLowerCase() !== venueFilter) return false;

  if (start && end && !Number.isNaN(start.getTime())) {
    const showTime = new Date(show.date).getTime();
    if (showTime < start.getTime() || showTime >= end.getTime()) {
      return false;
    }
  }

  if (queryText && !useElasticResults) {
    const haystack = [show.title, show.venue, show.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(queryText)) return false;
  }

  return true;
}

export const listTicketShows = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();
    await cleanupExpiredTicketHolds();

    const start = req.query.day ? new Date(req.query.day) : null;
    const end =
      start && !Number.isNaN(start.getTime())
        ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
        : null;
    const titleFilter = String(req.query.title || "").trim().toLowerCase();
    const cityFilter = String(req.query.city || "").trim().toLowerCase();
    const venueFilter = String(req.query.venue || "").trim().toLowerCase();
    const queryText = String(req.query.q || "").trim();

    const allShows = await listHydratedTicketShows();
    const allShowsById = new Map(
      allShows.map((show) => [String(show._id), show]),
    );

    let candidateShows = allShows;
    let useElasticResults = false;

    if (queryText) {
      const searchResults = await searchShows(queryText, 100);
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        const orderedIds = searchResults.map((hit) => String(hit._id));
        candidateShows = orderedIds
          .map((id) => allShowsById.get(id))
          .filter(Boolean);
        useElasticResults = true;
      }
    }

    const shows = candidateShows.filter((show) => {
      if (req.query.type && req.query.type !== "movie") return false;
      return matchesTicketShowFilters(show, {
        titleFilter,
        cityFilter,
        venueFilter,
        start,
        end,
        queryText,
        useElasticResults,
      });
    });

    const showIds = shows.map((show) => show._id);
    const reservations = await TicketSeatReservation.find({ show: { $in: showIds } }).lean();
    const reservationMap = new Map();

    for (const reservation of reservations) {
      const key = String(reservation.show);
      const list = reservationMap.get(key) || [];
      list.push(reservation);
      reservationMap.set(key, list);
    }

    const payload = shows.map((show) => {
      const seatSnapshot = buildSeatSnapshot(show, reservationMap.get(String(show._id)) || []);
      return mapTicketShowSummary(show, seatSnapshot.counters);
    });

    res.json({ shows: payload });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTicketShow = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();
    const state = await getTicketShowSeatState(req.params.id);
    if (!state) return res.status(404).json({ message: 'Ticket show not found' });

    res.json({
      show: state.show,
      seatSnapshot: state.seatSnapshot,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTicketShowPoster = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file.' });
    }

    const sourceShow = await findHydratedTicketShowById(req.params.id);
    if (!sourceShow) {
      return res.status(404).json({ message: 'Ticket show not found' });
    }

    const uploadedPoster = await storeUploadedImage(req.file, {
      folder: 'ticket-shows',
    });
    const posterUrl = uploadedPoster?.url;
    await Movie.updateOne({ movie_id: sourceShow.movie_id }, { posterUrl });
    const updatedShow = await findHydratedTicketShowById(req.params.id);

    res.json({
      message: `Poster updated for ${sourceShow.title}.`,
      show: updatedShow,
      posterUrl,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const myTicketBookings = async (req, res) => {
  try {
    await cleanupExpiredTicketHolds(req.query.showId || null);

    const filter = { user: req.user.id };
    if (req.query.showId) filter.show = req.query.showId;
    if (req.query.status) {
      const statuses = req.query.status.split(',').map((status) => status.trim()).filter(Boolean);
      if (statuses.length) filter.status = { $in: statuses };
    }

    const bookings = await TicketBooking.find(filter).sort({ createdAt: -1 });
    const showIds = [...new Set(bookings.map((booking) => String(booking.show)).filter(Boolean))];
    const shows = await Show.find({ _id: { $in: showIds } });
    const hydratedShows = await hydrateTicketShows(shows);
    const showsById = new Map(
      hydratedShows.map((show) => [
        String(show._id),
        mapTicketShowSummary(show, show.counters || { total: show.seats.length, available: 0, held: 0, booked: 0 }),
      ]),
    );

    res.json({
      bookings: bookings.map((booking) =>
        formatBooking(booking, showsById.get(String(booking.show))),
      ),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const holdTicketSeats = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();
    const seatIds = [...new Set(Array.isArray(req.body?.seatIds) ? req.body.seatIds : [])];
    if (!seatIds.length) return res.status(400).json({ message: 'Select at least one seat' });

    const state = await getTicketShowSeatState(req.params.id);
    if (!state) return res.status(404).json({ message: 'Ticket show not found' });

    const seatsById = new Map(state.seatSnapshot.seats.map((seat) => [seat.seatId, seat]));
    const selectedSeats = seatIds.map((seatId) => seatsById.get(seatId)).filter(Boolean);
    const invalidSeats = seatIds.filter((seatId) => !seatsById.has(seatId));
    const unavailableSeats = selectedSeats
      .filter((seat) => seat.status !== 'available')
      .map((seat) => seat.seatId);

    if (invalidSeats.length) {
      return res.status(400).json({ message: 'One or more selected seats are invalid' });
    }

    if (unavailableSeats.length) {
      return res.status(409).json({
        message: 'Some seats are no longer available',
        unavailableSeats,
      });
    }

    await cancelActiveBookingsForUser(state.show._id, req.user.id);

    const holdExpiresAt = new Date(Date.now() + getTicketHoldDurationMs());
    const amount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const bookingReference = generateTicketBookingReference();
    const lockResult = await lockSeats(
      state.show._id,
      seatIds,
      bookingReference,
      env.ticketHoldMinutes * 60,
    );

    if (lockResult.conflictSeatId) {
      return res.status(409).json({
        message: 'Some seats are no longer available',
        unavailableSeats: [lockResult.conflictSeatId],
      });
    }

    const booking = await TicketBooking.create({
      user: req.user.id,
      show: state.show._id,
      seats: selectedSeats,
      amount,
      currency: state.show.currency,
      status: 'held',
      holdExpiresAt,
      bookingReference,
    });

    try {
      await TicketSeatReservation.insertMany(
        selectedSeats.map((seat) => ({
          show: state.show._id,
          booking: booking._id,
          user: req.user.id,
          seatId: seat.seatId,
          row: seat.row,
          number: seat.number,
          section: seat.section,
          price: seat.price,
          status: 'held',
          holdExpiresAt,
        }))
      );
    } catch (error) {
      await TicketSeatReservation.deleteMany({ booking: booking._id });
      await TicketBooking.findByIdAndDelete(booking._id);
      await releaseSeats(
        state.show._id,
        selectedSeats.map((seat) => seat.seatId),
        bookingReference,
      );

      if (error.code === 11000) {
        return res.status(409).json({ message: 'Some seats were just taken. Please choose again.' });
      }

      throw error;
    }

    await invalidateShowCache(state.show._id);
    await broadcastTicketSeatState(state.show._id);

    res.status(201).json({
      booking: formatBooking(booking, state.show),
      holdDurationMinutes: env.ticketHoldMinutes,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const releaseTicketHold = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status === 'paid') return res.status(400).json({ message: 'Paid bookings cannot be released' });

    booking.status = 'cancelled';
    await booking.save();
    await TicketSeatReservation.deleteMany({ booking: booking._id, status: 'held' });
    await releaseSeats(
      booking.show,
      booking.seats.map((seat) => seat.seatId),
      booking.bookingReference || String(booking._id),
    );
    await invalidateShowCache(booking.show);
    await broadcastTicketSeatState(booking.show);

    res.json({ message: 'Seat hold released' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const cancelTicketBooking = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ message: 'This booking has already been cancelled' });
    if (booking.status === 'expired') return res.status(400).json({ message: 'This booking has already expired' });
    if (!['held', 'pending_payment', 'paid'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking cannot be cancelled' });
    }

    const show = await findHydratedTicketShowById(booking.show);
    if (!show) return res.status(404).json({ message: 'Ticket show not found' });

    const refundAmount = booking.status === 'paid' ? Number(booking.amount || 0) : 0;
    booking.status = 'cancelled';
    booking.refundAmount = refundAmount;
    booking.refundStatus = refundAmount > 0 ? 'credited' : 'not_required';
    booking.refundReference = refundAmount > 0 ? generateRefundReference('TKT') : undefined;
    booking.refundedAt = refundAmount > 0 ? new Date() : undefined;
    booking.holdExpiresAt = undefined;
    await booking.save();

    await TicketSeatReservation.deleteMany({ booking: booking._id });
    await releaseSeats(
      booking.show,
      booking.seats.map((seat) => seat.seatId),
      booking.bookingReference || String(booking._id),
    );
    await invalidateShowCache(booking.show);

    let updatedUser = null;
    if (refundAmount > 0) {
      updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { walletBalance: refundAmount } },
        { new: true }
      ).select('walletBalance');
    }

    try {
      const bookingUser = await User.findById(req.user.id).select('name email').lean();
      if (bookingUser?.email) {
        const emailContent = buildTicketCancellationEmail(bookingUser, booking, show, refundAmount);
        void emailQueue.add(
          { to: bookingUser.email, ...emailContent },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        );
      }
    } catch (emailErr) {
      console.error(`Failed to send ticket cancellation email: ${emailErr.message}`);
    }

    await broadcastTicketSeatState(booking.show);

    res.json({
      booking: formatBooking(
        booking,
        mapTicketShowSummary(show, {
          total: show.seats.length,
          available: 0,
          held: 0,
          booked: 0,
        }),
      ),
      walletBalance: updatedUser?.walletBalance ?? null,
      refundAmount,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const createTicketPaymentOrder = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status === 'paid') return res.status(400).json({ message: 'Booking is already paid' });
    if (!['held', 'pending_payment'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking is no longer active. Please select your seats again.' });
    }

    const state = await getTicketShowSeatState(booking.show);
    if (!state) return res.status(404).json({ message: 'Ticket show not found' });

    if (booking.holdExpiresAt && booking.holdExpiresAt <= new Date()) {
      booking.status = 'expired';
      await booking.save();
      await TicketSeatReservation.deleteMany({ booking: booking._id, status: 'held' });
      await invalidateShowCache(booking.show);
      await broadcastTicketSeatState(booking.show);
      return res.status(400).json({ message: 'Seat hold expired. Please choose seats again.' });
    }

    if (booking.status === 'pending_payment' && booking.razorpayOrderId) {
      return res.json({
        keyId: env.razorpayKeyId,
        order: {
          id: booking.razorpayOrderId,
          amount: Math.round(booking.amount * 100),
          currency: booking.currency,
          receipt: booking.bookingReference,
        },
        booking: formatBooking(
          booking,
          state.show,
        ),
      });
    }

    const order = await createRazorpayOrder({
      amount: Math.round(booking.amount * 100),
      currency: booking.currency,
      receipt: booking.bookingReference,
      notes: {
        bookingReference: booking.bookingReference,
        showId: String(booking.show),
        userId: String(req.user.id),
      },
    });

    booking.razorpayOrderId = order.id;
    booking.status = 'pending_payment';
    await booking.save();
    await invalidateShowCache(booking.show);
    await broadcastTicketSeatState(booking.show);

    res.json({
      keyId: env.razorpayKeyId,
      order,
      booking: formatBooking(booking, state.show),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const verifyTicketPayment = async (req, res) => {
  try {
    const booking = await TicketBooking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const state = await getTicketShowSeatState(booking.show);
    if (!state) return res.status(404).json({ message: 'Ticket show not found' });

    if (booking.status === 'paid') {
      return res.json({
        success: true,
        booking: formatBooking(booking, state.show),
      });
    }

    if (!['held', 'pending_payment'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking is no longer active. Please select your seats again.' });
    }

    const orderId = req.body?.razorpay_order_id;
    const paymentId = req.body?.razorpay_payment_id;
    const signature = req.body?.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: 'Incomplete payment response' });
    }

    if (booking.razorpayOrderId !== orderId) {
      return res.status(400).json({ message: 'Payment order mismatch' });
    }

    if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    const result = await finalizeTicketBookingPayment({
      booking,
      show: state.show,
      paymentId,
      signature,
      user: req.user,
    });

    if (result.alreadyPaid) {
      return res.json({
        success: true,
        booking: result.booking,
      });
    }

    res.json({
      booking: result.booking,
      payment: result.payment,
      success: true,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const verifyRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ message: 'Missing Razorpay webhook signature' });
    }

    const rawBody = req.rawBody || '';
    if (!rawBody) {
      return res.status(400).json({ message: 'Missing webhook payload' });
    }

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ message: 'Invalid webhook payload' });
    }

    const details = extractWebhookPaymentDetails(payload);
    if (!details.orderId || !details.paymentId) {
      return res.status(400).json({ message: 'Webhook payload missing payment details' });
    }

    const booking =
      (await TicketBooking.findOne({ razorpayOrderId: details.orderId })) ||
      (await TicketBooking.findOne({ razorpayPaymentId: details.paymentId }));

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found for webhook payload' });
    }

    if (booking.status === 'paid') {
      return res.json({ success: true, alreadyPaid: true });
    }

    const state = await getTicketShowSeatState(booking.show);
    if (!state) {
      return res.status(404).json({ message: 'Ticket show not found' });
    }

    const result = await finalizeTicketBookingPayment({
      booking,
      show: state.show,
      paymentId: details.paymentId,
      signature,
      payment: {
        id: details.paymentId,
        status: details.status || 'captured',
        amount: details.amount,
        currency: details.currency,
        captured: details.status === 'captured',
        order_id: details.orderId,
      },
    });

    return res.json({
      success: true,
      booking: result.booking,
      payment: result.payment,
      alreadyPaid: result.alreadyPaid,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};
