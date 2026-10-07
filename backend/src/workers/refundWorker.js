import { refundQueue } from '../queues/index.js';

refundQueue.process(async (job) => {
  console.log(`Refund job ${job.id} received`, job.data || {});
});

refundQueue.on('failed', (job, error) => {
  console.error(`Refund job ${job?.id || 'unknown'} failed:`, error.message);
});
