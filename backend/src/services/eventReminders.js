import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import { sendEmail } from "../utils/email.js";
import { buildRegistrationReminderEmail } from "../controllers/registrationController.js";
import { env } from "../config/env.js";

const ACTIVE_REMINDER_STATUSES = ["registered"];
const REMINDER_LOOKAHEAD_HOURS = Number(env.eventReminderLookaheadHours || 24);
const REMINDER_INTERVAL_MS = Number(env.eventReminderIntervalMinutes || 60) * 60 * 1000;

function getReminderWindow() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_LOOKAHEAD_HOURS * 60 * 60 * 1000);

  return { now, windowEnd };
}

export async function sendUpcomingEventReminders() {
  const { now, windowEnd } = getReminderWindow();
  const upcomingEvents = await Event.find({
    status: "approved",
    date: { $gte: now, $lt: windowEnd },
  })
    .select("_id title date location currency")
    .lean();

  if (!upcomingEvents.length) {
    return { events: 0, remindersSent: 0 };
  }

  const upcomingEventIds = upcomingEvents.map((event) => event._id);
  const registrations = await Registration.find({
    event: { $in: upcomingEventIds },
    status: { $in: ACTIVE_REMINDER_STATUSES },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: null }],
  })
    .populate("user", "name email")
    .populate("event")
    .sort({ createdAt: 1 });

  let remindersSent = 0;

  for (const registration of registrations) {
    const user = registration.user;
    const event = registration.event;
    if (!user?.email || !event) continue;

    try {
      const emailContent = buildRegistrationReminderEmail(user, event, registration);
      await sendEmail({ to: user.email, ...emailContent });
      registration.reminderSentAt = new Date();
      await registration.save({ validateBeforeSave: false });
      remindersSent += 1;
    } catch (error) {
      console.error(
        `Failed to send reminder for event ${event?.title || event?._id} to ${user?.email}: ${error.message}`,
      );
    }
  }

  return { events: upcomingEvents.length, remindersSent };
}

export function startEventReminderLoop() {
  const run = async () => {
    try {
      const result = await sendUpcomingEventReminders();
      if (result.events || result.remindersSent) {
        console.log(
          `[reminders] scanned ${result.events} event(s); sent ${result.remindersSent} reminder email(s)`,
        );
      }
    } catch (error) {
      console.error(`[reminders] job failed: ${error.message}`);
    }
  };

  void run();
  return setInterval(run, REMINDER_INTERVAL_MS);
}
