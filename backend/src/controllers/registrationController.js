import { randomBytes } from 'crypto';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { sendEmail } from '../utils/email.js';
import { generateQRCodeDataUrl } from '../utils/qrcode.js';
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  verifyRazorpaySignature,
} from '../services/razorpay.js';

const ACTIVE_REGISTRATION_STATUSES = ['registered', 'attended'];
const OCCUPIED_REGISTRATION_STATUSES = ['pending_payment', 'registered', 'attended'];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatEventDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'To be announced';

  return date.toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getBookingLabel(bookingType) {
  return bookingType === 'permanent' ? 'Permanent Booking' : 'Free Registration';
}

function normalizeCurrency(currency) {
  return (currency || 'INR').toUpperCase();
}

function normalizeTicketOptionKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatTicketOptionLabel(option) {
  if (!option) return 'Registration';
  return option.label || 'Registration';
}

function getConfiguredTicketOptions(event) {
  const options = Array.isArray(event?.ticketOptions) ? event.ticketOptions : [];
  return options
    .map((option, index) => {
      const label = String(option?.label || '').trim();
      if (!label) return null;

      const key = normalizeTicketOptionKey(option?.key || label || `ticket-${index + 1}`) || `ticket-${index + 1}`;
      const price = Number(option?.price ?? 0);
      const capacity = Number(option?.capacity ?? 0);

      return {
        key,
        label,
        description: String(option?.description || '').trim(),
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        capacity: Number.isFinite(capacity) && capacity >= 0 ? capacity : 0,
        active: option?.active !== false,
        featured: Boolean(option?.featured),
      };
    })
    .filter(Boolean)
    .filter((option) => option.active);
}

function getDefaultTicketOptions(event) {
  const freeOption = {
    key: 'free',
    label: 'Free Registration',
    description: 'Register instantly without making a payment.',
    price: 0,
    capacity: Number(event?.capacity || 0),
    active: true,
    featured: true,
  };

  const paidPrice = getPermanentBookingPrice(event);
  const paidOption = paidPrice > 0
    ? {
        key: 'permanent',
        label: 'Permanent Booking',
        description: 'Secure your spot with payment and receive a permanent booking reference.',
        price: paidPrice,
        capacity: Number(event?.capacity || 0),
        active: true,
        featured: true,
      }
    : null;

  return paidOption ? [paidOption, freeOption] : [freeOption];
}

function getEventTicketOptions(event) {
  const configured = getConfiguredTicketOptions(event);
  return configured.length ? configured : getDefaultTicketOptions(event);
}

function resolveTicketOption(event, requestedKey = '') {
  const options = getEventTicketOptions(event);
  const normalizedKey = normalizeTicketOptionKey(requestedKey);

  if (normalizedKey) {
    const directMatch = options.find((option) => option.key === normalizedKey);
    if (directMatch) return directMatch;
  }

  if (!normalizedKey && options.length === 1) {
    return options[0];
  }

  const freeMatch = options.find((option) => option.price <= 0 || option.key === 'free');
  if (freeMatch && (!normalizedKey || normalizedKey === 'free')) return freeMatch;

  const paidMatch = options.find((option) => option.price > 0 || option.key === 'permanent');
  if (paidMatch && normalizedKey === 'permanent') return paidMatch;

  return options[0] || null;
}

async function countOccupiedRegistrations(eventId, ticketOptionKey = null) {
  const filter = {
    event: eventId,
    status: { $in: OCCUPIED_REGISTRATION_STATUSES },
  };

  if (ticketOptionKey) {
    filter.ticketOptionKey = ticketOptionKey;
  }

  return Registration.countDocuments(filter);
}

function createTicketAvailabilityError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function applyTicketOptionToRegistration(registration, event, ticketOption) {
  const previousBookingType = registration.bookingType;
  const previousTicketOptionKey = registration.ticketOptionKey;
  const bookingType = ticketOption.price > 0 ? 'permanent' : 'free';

  registration.bookingType = bookingType;
  registration.ticketOptionKey = ticketOption.key;
  registration.ticketOptionLabel = ticketOption.label;
  registration.bookingReference =
    !registration.bookingReference ||
    previousBookingType !== bookingType ||
    previousTicketOptionKey !== ticketOption.key
      ? generateBookingReference(bookingType)
      : registration.bookingReference;
  registration.amount = Number(ticketOption.price || 0);
  registration.currency = normalizeCurrency(event.currency);
  registration.paymentProvider = 'razorpay';
  registration.razorpayOrderId = undefined;
  registration.razorpayPaymentId = undefined;
  registration.razorpaySignature = undefined;
  registration.paidAt = undefined;
  registration.refundAmount = 0;
  registration.refundStatus = 'none';
  registration.refundReference = undefined;
  registration.refundedAt = undefined;
  registration.checkedInAt = undefined;
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function getPermanentBookingPrice(event) {
  const value = Number(event?.permanentBookingPrice || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function generateBookingReference(bookingType) {
  const prefix = bookingType === 'permanent' ? 'BOOK' : 'FREE';
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function findManageableEvent(eventId, user) {
  const filter =
    user?.role === 'admin'
      ? { _id: eventId }
      : { _id: eventId, organizer: user?.id };

  return Event.findOne(filter);
}

function buildRegistrationEmail(user, event, registration) {
  const bookingLabel =
    registration?.ticketOptionLabel ||
    getBookingLabel(registration?.bookingType || 'free');
  const bookingReference = registration?.bookingReference || 'Will be assigned at confirmation';
  const eventDate = formatEventDate(event.date);
  const eventLocation = event.location || 'To be announced';
  const eventUrl = `${env.clientUrl.replace(/\/$/, '')}/events/${event._id}`;
  const greetingName = user?.name || 'there';
  const paymentLine =
    registration?.bookingType === 'permanent'
      ? `Amount paid: ${formatCurrency(registration.amount, registration.currency)}`
      : 'Amount paid: No payment required';
  const paymentHtml =
    registration?.bookingType === 'permanent'
      ? `<div style="margin-bottom: 8px;"><strong>Amount paid:</strong> ${formatCurrency(registration.amount, registration.currency)}</div>`
      : `<div style="margin-bottom: 8px;"><strong>Amount paid:</strong> No payment required</div>`;

  return {
    subject: `Registration confirmed: ${event.title}`,
    text: [
      `Hi ${greetingName},`,
      '',
      `Your registration for "${event.title}" is confirmed.`,
      `Booking type: ${bookingLabel}`,
      `Reference: ${bookingReference}`,
      paymentLine,
      `Date: ${eventDate}`,
      `Location: ${eventLocation}`,
      `View event details: ${eventUrl}`,
      '',
      'We look forward to seeing you there.',
      '',
      'EventManager Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Registration Confirmed</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${event.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${greetingName}, your seat is confirmed. Your event registration has been completed successfully.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Booking type:</strong> ${bookingLabel}</div>
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${bookingReference}</div>
            ${paymentHtml}
            <div style="margin-bottom: 8px;"><strong>Date:</strong> ${eventDate}</div>
            <div style="margin-bottom: 8px;"><strong>Location:</strong> ${eventLocation}</div>
            <div><strong>Status:</strong> Registered</div>
          </div>

          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6;">You can revisit the event page anytime for updates, directions, and your ticket details.</p>

          <a href="${eventUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            Open Event Page
          </a>

          <p style="margin: 24px 0 0; font-size: 14px; color: #475569;">Thanks,<br />EventManager Team</p>
        </div>
      </div>
    `,
  };
}

export function buildRegistrationReminderEmail(user, event, registration) {
  const bookingLabel =
    registration?.ticketOptionLabel ||
    getBookingLabel(registration?.bookingType || 'free');
  const eventDate = formatEventDate(event.date);
  const eventLocation = event.location || 'To be announced';
  const eventUrl = `${env.clientUrl.replace(/\/$/, '')}/events/${event._id}`;

  return {
    subject: `Reminder: ${event.title} starts soon`,
    text: [
      `Hi ${user?.name || 'there'},`,
      '',
      `This is a reminder that "${event.title}" is starting within the next 24 hours.`,
      `Booking type: ${bookingLabel}`,
      `Reference: ${registration.bookingReference || 'Assigned automatically'}`,
      `Date: ${eventDate}`,
      `Location: ${eventLocation}`,
      `View event details: ${eventUrl}`,
      '',
      'See you there.',
      '',
      'EventManager Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Event Reminder</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${event.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${user?.name || 'there'}, your event is coming up soon. We sent this reminder because you are registered for the event.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Ticket:</strong> ${bookingLabel}</div>
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${registration.bookingReference || 'Assigned automatically'}</div>
            <div style="margin-bottom: 8px;"><strong>Date:</strong> ${eventDate}</div>
            <div><strong>Location:</strong> ${eventLocation}</div>
          </div>

          <a href="${eventUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            Open Event Page
          </a>
        </div>
      </div>
    `,
  };
}

function buildRegistrationCancellationEmail(user, event, registration, refundAmount) {
  return {
    subject: `Registration cancelled: ${event.title}`,
    text: [
      `Hi ${user?.name || 'there'},`,
      '',
      `Your registration for "${event.title}" has been cancelled.`,
      `Booking type: ${getBookingLabel(registration.bookingType || 'free')}`,
      `Reference: ${registration.bookingReference || 'Will be assigned at confirmation'}`,
      refundAmount > 0
        ? `Refund credited: ${formatCurrency(refundAmount, registration.currency)}`
        : 'Refund credited: No payment refund was due for this cancellation.',
      '',
      'EventManager Team',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Registration Cancelled</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${event.title}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${user?.name || 'there'}, your registration has been cancelled successfully.</p>

          <div style="border-radius: 16px; background: #eff6ff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Booking type:</strong> ${getBookingLabel(registration.bookingType || 'free')}</div>
            <div style="margin-bottom: 8px;"><strong>Reference:</strong> ${registration.bookingReference || 'Will be assigned at confirmation'}</div>
            <div><strong>Refund status:</strong> ${refundAmount > 0 ? formatCurrency(refundAmount, registration.currency) : 'No payment refund was due'}</div>
          </div>

          <p style="margin: 24px 0 0; font-size: 14px; color: #475569;">${refundAmount > 0 ? 'The refund has been credited to your account wallet.' : 'This cancellation did not require a payment refund.'}</p>
        </div>
      </div>
    `,
  };
}

async function finalizeRegistration({ registration, event, user }) {
  const payload = JSON.stringify({
    userId: registration.user,
    eventId: event._id,
    bookingType: registration.bookingType,
    ticketOptionKey: registration.ticketOptionKey || null,
    ticketOptionLabel: registration.ticketOptionLabel || null,
    bookingReference: registration.bookingReference,
    paidAt: registration.paidAt || null,
    at: Date.now(),
  });

  registration.status = 'registered';
  registration.qrCodeDataUrl = await generateQRCodeDataUrl(payload);
  await registration.save();

  try {
    if (user?.email) {
      const emailContent = buildRegistrationEmail(user, event, registration);
      await sendEmail({ to: user.email, ...emailContent });
    }
  } catch (emailErr) {
    console.error(`Failed to send registration email to ${user?.email}: ${emailErr.message}`);
  }
}

function serializeRegistration(registrationDoc) {
  const registration = registrationDoc.toObject ? registrationDoc.toObject() : registrationDoc;

  return {
    _id: registration._id,
    user: registration.user,
    event: registration.event,
    bookingType: registration.bookingType,
    bookingReference: registration.bookingReference,
    amount: registration.amount,
    currency: registration.currency,
    status: registration.status,
    paymentProvider: registration.paymentProvider,
    razorpayOrderId: registration.razorpayOrderId,
    razorpayPaymentId: registration.razorpayPaymentId,
    paidAt: registration.paidAt,
    qrCodeDataUrl: registration.qrCodeDataUrl,
    checkedInAt: registration.checkedInAt,
    refundAmount: registration.refundAmount || 0,
    refundStatus: registration.refundStatus || 'none',
    refundReference: registration.refundReference || null,
    refundedAt: registration.refundedAt || null,
    reminderSentAt: registration.reminderSentAt || null,
    createdAt: registration.createdAt,
  };
}

export const cancelRegistration = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      user: req.user.id,
    }).populate('event');

    if (!registration) return res.status(404).json({ message: 'Registration booking not found' });
    if (!registration.event || registration.event.status !== 'approved') {
      return res.status(400).json({ message: 'Event not available' });
    }
    if (registration.status === 'cancelled') {
      return res.status(400).json({ message: 'This booking has already been cancelled.' });
    }
    if (registration.status !== 'registered') {
      return res.status(400).json({ message: 'Only active registrations can be cancelled.' });
    }
    if (registration.checkedInAt) {
      return res.status(400).json({ message: 'Checked-in registrations cannot be cancelled.' });
    }

    const refundAmount = registration.bookingType === 'permanent' ? Number(registration.amount || 0) : 0;
    registration.status = 'cancelled';
    registration.qrCodeDataUrl = undefined;
    registration.checkedInAt = undefined;
    registration.refundAmount = refundAmount;
    registration.refundStatus = refundAmount > 0 ? 'credited' : 'not_required';
    registration.refundReference =
      refundAmount > 0
        ? `RFD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
        : undefined;
    registration.refundedAt = refundAmount > 0 ? new Date() : undefined;
    await registration.save();

    let updatedUser = null;
    if (refundAmount > 0) {
      updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { walletBalance: refundAmount } },
        { new: true }
      ).select('walletBalance');
    }

    try {
      if (req.user.email) {
        const emailContent = buildRegistrationCancellationEmail(
          req.user,
          registration.event,
          registration,
          refundAmount,
        );
        await sendEmail({ to: req.user.email, ...emailContent });
      }
    } catch (emailErr) {
      console.error(`Failed to send registration cancellation email to ${req.user.email}: ${emailErr.message}`);
    }

    res.json({
      registration: serializeRegistration(registration),
      walletBalance: updatedUser?.walletBalance ?? null,
      refundAmount,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

async function findEventForBooking(eventId) {
  const event = await Event.findById(eventId);
  if (!event || event.status !== 'approved') return null;
  return event;
}

export const registerForEvent = async (req, res) => {
  try {
    const event = await findEventForBooking(req.params.id);
    if (!event) return res.status(400).json({ message: 'Event not available' });

    const requestedKey = req.body?.ticketOptionKey || req.body?.bookingType || 'free';
    const ticketOption = resolveTicketOption(event, requestedKey);
    if (!ticketOption) {
      return res.status(400).json({ message: 'Invalid ticket option' });
    }
    if (ticketOption.price > 0) {
      return res.status(400).json({ message: 'Paid ticket options require payment. Start the Razorpay flow first.' });
    }

    const existingRegistration = await Registration.findOne({ user: req.user.id, event: event._id });
    if (existingRegistration && ACTIVE_REGISTRATION_STATUSES.includes(existingRegistration.status)) {
      return res.status(409).json({ message: 'You are already registered for this event' });
    }

    const occupiedCount = await countOccupiedRegistrations(event._id);
    if (event.capacity > 0 && occupiedCount >= Number(event.capacity || 0)) {
      return res.status(400).json({ message: 'This event has reached its capacity.' });
    }

    if (ticketOption.capacity > 0) {
      const optionCount = await countOccupiedRegistrations(event._id, ticketOption.key);
      if (optionCount >= ticketOption.capacity) {
        return res.status(400).json({ message: `The ${ticketOption.label} ticket option is sold out.` });
      }
    }

    const registration =
      existingRegistration ||
      new Registration({
        user: req.user.id,
        event: event._id,
      });

    applyTicketOptionToRegistration(registration, event, ticketOption);

    await finalizeRegistration({
      registration,
      event,
      user: req.user,
    });

    res.status(201).json({ registration: serializeRegistration(registration) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createRegistrationPaymentOrder = async (req, res) => {
  try {
    const event = await findEventForBooking(req.params.id);
    if (!event) return res.status(400).json({ message: 'Event not available' });

    const requestedKey = req.body?.ticketOptionKey || req.body?.bookingType || 'permanent';
    const ticketOption = resolveTicketOption(event, requestedKey);
    if (!ticketOption) {
      return res.status(400).json({ message: 'Invalid ticket option' });
    }
    if (ticketOption.price <= 0) {
      return res.status(400).json({ message: 'This ticket option does not require payment. Use regular registration instead.' });
    }

    const currency = normalizeCurrency(event.currency);
    const existingRegistration = await Registration.findOne({ user: req.user.id, event: event._id });
    if (existingRegistration && ACTIVE_REGISTRATION_STATUSES.includes(existingRegistration.status)) {
      return res.status(409).json({ message: 'You are already registered for this event' });
    }

    const occupiedCount = await countOccupiedRegistrations(event._id);
    if (event.capacity > 0 && occupiedCount >= Number(event.capacity || 0)) {
      return res.status(400).json({ message: 'This event has reached its capacity.' });
    }

    if (ticketOption.capacity > 0) {
      const optionCount = await countOccupiedRegistrations(event._id, ticketOption.key);
      if (optionCount >= ticketOption.capacity) {
        return res.status(400).json({ message: `The ${ticketOption.label} ticket option is sold out.` });
      }
    }

    const registration =
      existingRegistration ||
      new Registration({
        user: req.user.id,
        event: event._id,
      });

    applyTicketOptionToRegistration(registration, event, ticketOption);
    registration.currency = currency;
    registration.status = 'pending_payment';
    registration.paymentProvider = 'razorpay';
    registration.qrCodeDataUrl = undefined;
    registration.paidAt = undefined;

    const order = await createRazorpayOrder({
      amount: Math.round(ticketOption.price * 100),
      currency,
      receipt: registration.bookingReference,
      notes: {
        registrationId: String(registration._id),
        bookingReference: registration.bookingReference,
        eventId: String(event._id),
        userId: String(req.user.id),
      },
    });

    registration.razorpayOrderId = order.id;
    await registration.save();

    res.json({
      keyId: env.razorpayKeyId,
      order,
      registration: serializeRegistration(registration),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const verifyRegistrationPayment = async (req, res) => {
  try {
    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      user: req.user.id,
    }).populate('event');

    if (!registration) return res.status(404).json({ message: 'Registration booking not found' });
    if (!registration.event || registration.event.status !== 'approved') {
      return res.status(400).json({ message: 'Event not available' });
    }
    if (ACTIVE_REGISTRATION_STATUSES.includes(registration.status)) {
      return res.status(400).json({ message: 'This booking has already been completed.' });
    }
    if (registration.bookingType !== 'permanent') {
      return res.status(400).json({ message: 'This registration does not require payment.' });
    }

    const orderId = req.body?.razorpay_order_id;
    const paymentId = req.body?.razorpay_payment_id;
    const signature = req.body?.razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: 'Incomplete payment response' });
    }

    if (registration.razorpayOrderId !== orderId) {
      return res.status(400).json({ message: 'Payment order mismatch' });
    }

    if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    let payment = await fetchRazorpayPayment(paymentId);
    if (payment.status === 'authorized' && !payment.captured) {
      payment = await captureRazorpayPayment(paymentId, payment.amount, payment.currency);
    }

    if (!['authorized', 'captured'].includes(payment.status)) {
      return res.status(400).json({ message: `Payment not completed. Current status: ${payment.status}` });
    }

    const expectedAmount = Math.round((registration.amount || 0) * 100);
    if (payment.amount !== expectedAmount || normalizeCurrency(payment.currency) !== normalizeCurrency(registration.currency)) {
      return res.status(400).json({ message: 'Payment amount verification failed' });
    }

    registration.razorpayPaymentId = paymentId;
    registration.razorpaySignature = signature;
    registration.paidAt = new Date();

    await finalizeRegistration({
      registration,
      event: registration.event,
      user: req.user,
    });

    res.json({
      registration: serializeRegistration(registration),
      payment,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const myRegistrations = async (req, res) => {
  try {
    const regs = await Registration.find({
      user: req.user.id,
      status: { $ne: 'pending_payment' },
    }).populate('event');

    res.json({ registrations: regs.map((registration) => serializeRegistration(registration)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const organizerEventAnalytics = async (req, res) => {
  try {
    const eventFilter =
      req.user.role === 'admin'
        ? {}
        : { organizer: req.user.id };

    const events = await Event.find(eventFilter)
      .sort({ date: 1 })
      .lean();

    if (!events.length) {
      return res.json({
        analytics: [],
        summary: {
          events: 0,
          participants: 0,
          attended: 0,
          registered: 0,
          free: 0,
          permanent: 0,
          revenue: 0,
        },
      });
    }

    const eventIds = events.map((event) => event._id);
    const registrations = await Registration.find({
      event: { $in: eventIds },
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const registrationsByEvent = new Map();
    for (const registration of registrations) {
      const key = String(registration.event);
      const list = registrationsByEvent.get(key) || [];
      list.push(registration);
      registrationsByEvent.set(key, list);
    }

    const analytics = events.map((event) => {
      const eventRegistrations = registrationsByEvent.get(String(event._id)) || [];
      const attended = eventRegistrations.filter((registration) => registration.status === 'attended').length;
      const registered = eventRegistrations.filter((registration) => registration.status === 'registered').length;
      const permanent = eventRegistrations.filter((registration) => registration.bookingType === 'permanent');
      const free = eventRegistrations.filter((registration) => registration.bookingType !== 'permanent');
      const revenue = permanent.reduce((sum, registration) => sum + Number(registration.amount || 0), 0);
      const participants = eventRegistrations.map((registration) => ({
        _id: registration._id,
        user: registration.user,
        bookingType: registration.bookingType,
        bookingReference: registration.bookingReference,
        amount: registration.amount,
        currency: registration.currency,
        status: registration.status,
        createdAt: registration.createdAt,
        checkedInAt: registration.checkedInAt,
      }));
      const occupancyPercent = event.capacity
        ? Math.min(100, Math.round((participants.length / event.capacity) * 100))
        : 0;

      return {
        event,
        totals: {
          participants: participants.length,
          attended,
          registered,
          free: free.length,
          permanent: permanent.length,
          revenue,
          occupancyPercent,
          remainingCapacity: Math.max(0, Number(event.capacity || 0) - participants.length),
        },
        participants,
      };
    });

    const summary = analytics.reduce(
      (accumulator, item) => ({
        events: accumulator.events + 1,
        participants: accumulator.participants + item.totals.participants,
        attended: accumulator.attended + item.totals.attended,
        registered: accumulator.registered + item.totals.registered,
        free: accumulator.free + item.totals.free,
        permanent: accumulator.permanent + item.totals.permanent,
        revenue: accumulator.revenue + item.totals.revenue,
      }),
      {
        events: 0,
        participants: 0,
        attended: 0,
        registered: 0,
        free: 0,
        permanent: 0,
        revenue: 0,
      }
    );

    res.json({ analytics, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const participantsForEvent = async (req, res) => {
  try {
    const event = await findManageableEvent(req.params.id, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const regs = await Registration.find({
      event: event._id,
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }).populate('user', 'name email');

    res.json({ participants: regs.map((registration) => serializeRegistration(registration)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const checkInParticipant = async (req, res) => {
  try {
    const event = await findManageableEvent(req.params.id, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const reg = await Registration.findOneAndUpdate(
      { user: req.body.userId, event: event._id, status: 'registered' },
      { status: 'attended', checkedInAt: new Date() },
      { new: true }
    );

    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    res.json({ registration: serializeRegistration(reg) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const exportParticipantsCsv = async (req, res) => {
  try {
    const event = await findManageableEvent(req.params.id, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const regs = await Registration.find({
      event: event._id,
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }).populate('user', 'name email');

    const rows = regs.map((registration) => ({
      name: registration.user?.name || '',
      email: registration.user?.email || '',
      bookingType: getBookingLabel(registration.bookingType || 'free'),
      bookingReference: registration.bookingReference || '',
      amount: registration.amount ? formatCurrency(registration.amount, registration.currency) : 'Free',
      status: registration.status,
      registeredAt: registration.createdAt,
    }));

    const filePath = path.resolve(__dirname, `../../participants-${req.params.id}.csv`);
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'bookingType', title: 'Booking Type' },
        { id: 'bookingReference', title: 'Booking Reference' },
        { id: 'amount', title: 'Amount' },
        { id: 'status', title: 'Status' },
        { id: 'registeredAt', title: 'Registered At' },
      ],
    });

    await csvWriter.writeRecords(rows);
    res.download(filePath, err => {
      if (err) {
        console.error('Failed to send participants CSV:', err.message);
      }
      fs.promises.unlink(filePath).catch(() => {});
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
