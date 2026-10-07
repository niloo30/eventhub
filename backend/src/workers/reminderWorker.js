import TicketBooking from '../models/TicketBooking.js';
import { emailQueue, reminderQueue, smsQueue } from '../queues/index.js';

function buildReminderMessage(booking, type) {
  return type === '24h'
    ? `Reminder: Your show is tomorrow! Ref: ${booking.bookingReference}`
    : `Reminder: Your show starts in 2 hours! Ref: ${booking.bookingReference}`;
}

function buildReminderSubject(booking) {
  return `Show reminder - ${booking.show?.title || 'Your booking'}`;
}

reminderQueue.process(async (job) => {
  const { bookingId, type } = job.data || {};
  if (!bookingId || !type) {
    throw new Error('Reminder job is missing bookingId or type');
  }

  const booking = await TicketBooking.findById(bookingId).populate('user show');
  if (!booking || booking.status !== 'paid') {
    return;
  }

  const message = buildReminderMessage(booking, type);

  if (booking.user?.email) {
    await emailQueue.add(
      {
        to: booking.user.email,
        subject: buildReminderSubject(booking),
        html: `<p>${message}</p>`,
        text: message,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  }

  if (booking.user?.phone) {
    await smsQueue.add({
      phone: booking.user.phone,
      message,
    });
  }
});

reminderQueue.on('failed', (job, error) => {
  console.error(`Reminder job ${job.id} failed:`, error.message);
});
