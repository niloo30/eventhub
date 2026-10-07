import { smsQueue } from '../queues/index.js';

smsQueue.process(async (job) => {
  const { phone, message } = job.data || {};

  if (!phone || !message) {
    throw new Error('SMS job is missing phone or message');
  }

  console.log(`SMS notification ready for ${phone}: ${message}`);
});

smsQueue.on('failed', (job, error) => {
  console.error(`SMS job ${job?.id || 'unknown'} failed:`, error.message);
});
