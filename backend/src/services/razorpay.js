import crypto from 'crypto';
import { env } from '../config/env.js';

function getAuthorizationHeader() {
  const token = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
  return `Basic ${token}`;
}

async function razorpayRequest(path, options = {}) {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    const error = new Error('Razorpay keys are not configured');
    error.status = 400;
    throw error;
  }

  const response = await fetch(`https://api.razorpay.com${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.description || 'Razorpay request failed');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  return razorpayRequest('/v1/orders', {
    method: 'POST',
    body: { amount, currency, receipt, notes },
  });
}

export async function fetchRazorpayPayment(paymentId) {
  return razorpayRequest(`/v1/payments/${paymentId}`);
}

export async function captureRazorpayPayment(paymentId, amount, currency) {
  return razorpayRequest(`/v1/payments/${paymentId}/capture`, {
    method: 'POST',
    body: { amount, currency },
  });
}

export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
}
