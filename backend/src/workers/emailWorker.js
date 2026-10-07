import { emailQueue } from '../queues/index.js';
import { sendEmail } from '../utils/email.js';

emailQueue.process(async (job) => {
  const { to, subject, html, text } = job.data || {};

  if (!to || !subject) {
    throw new Error('Email job is missing recipient or subject');
  }

  await sendEmail({ to, subject, html, text });
  console.log(`Email sent to ${to}`);
});

emailQueue.on('failed', (job, error) => {
  console.error(`Email job ${job.id} failed:`, error.message);
});
