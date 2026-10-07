import crypto from 'crypto';
import 'dotenv/config';

const webhookUrl = process.env.RAZORPAY_WEBHOOK_URL || 'http://localhost:5050/api/tickets/webhook/razorpay';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

if (!webhookSecret) {
  console.error('Missing RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET.');
  process.exit(1);
}

const payload = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: process.env.RAZORPAY_TEST_PAYMENT_ID || 'pay_test_local_123',
        order_id: process.env.RAZORPAY_TEST_ORDER_ID || 'order_test_local_123',
        status: 'captured',
        amount: Number(process.env.RAZORPAY_TEST_AMOUNT || 10000),
        currency: process.env.RAZORPAY_TEST_CURRENCY || 'INR',
      },
    },
    order: {
      entity: {
        id: process.env.RAZORPAY_TEST_ORDER_ID || 'order_test_local_123',
        amount: Number(process.env.RAZORPAY_TEST_AMOUNT || 10000),
        currency: process.env.RAZORPAY_TEST_CURRENCY || 'INR',
      },
    },
  },
};

const rawBody = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');

const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
  },
  body: rawBody,
});

const responseText = await response.text();
console.log(`POST ${webhookUrl}`);
console.log(`Status: ${response.status}`);
console.log(responseText);
