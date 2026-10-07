import axios from 'axios';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const emailDeliveryTimeoutMs = Number(process.env.EMAIL_DELIVERY_TIMEOUT_MS || 10000);

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth:
        env.smtpUser && env.smtpPass
          ? { user: env.smtpUser, pass: env.smtpPass }
          : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    })
  : null;

function parseEmailFrom(fromStr = '') {
  const match = fromStr.match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
  if (match) {
    return { name: match[1]?.trim() || '', email: match[2]?.trim() || '' };
  }
  return { name: '', email: fromStr.trim() };
}

async function sendViaHttpRest({ to, subject, html, text, from }) {
  const parsedFrom = parseEmailFrom(from);
  const senderObject = parsedFrom.name
    ? { name: parsedFrom.name, email: parsedFrom.email }
    : { email: parsedFrom.email };

  // 1. Resend REST API (https://resend.com)
  if (env.resendApiKey) {
    const response = await axios.post(
      'https://api.resend.com/emails',
      { from, to, subject, html, text },
      {
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: emailDeliveryTimeoutMs,
      }
    );
    return response.data;
  }

  // 2. SendGrid REST API (https://sendgrid.com)
  if (env.sendgridApiKey) {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: to }] }],
        from: senderObject,
        subject,
        content: [
          ...(text ? [{ type: 'text/plain', value: text }] : []),
          ...(html ? [{ type: 'text/html', value: html }] : []),
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${env.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: emailDeliveryTimeoutMs,
      }
    );
    return response.data;
  }

  // 3. Brevo (Sendinblue) REST API (https://brevo.com)
  if (env.brevoApiKey) {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: senderObject,
        to: [{ email: to }],
        subject,
        htmlContent: html || text,
        textContent: text,
      },
      {
        headers: {
          'api-key': env.brevoApiKey,
          'Content-Type': 'application/json',
        },
        timeout: emailDeliveryTimeoutMs,
      }
    );
    return response.data;
  }

  // 4. Custom Generic HTTP REST API Endpoint
  if (env.emailApiUrl) {
    const headers = { 'Content-Type': 'application/json' };
    if (env.emailApiKey) {
      headers['Authorization'] = `Bearer ${env.emailApiKey}`;
    }
    const response = await axios.post(
      env.emailApiUrl,
      { from, to, subject, html, text },
      { headers, timeout: emailDeliveryTimeoutMs }
    );
    return response.data;
  }

  throw new Error('No HTTP email service API key or endpoint configured');
}

export async function sendEmail({ to, subject, html, text }) {
  const from = env.emailFrom || process.env.EMAIL_FROM || 'noreply@eventmanager.com';
  const mail = { from, to, subject, html, text };

  const hasHttpConfig = Boolean(
    env.resendApiKey || env.sendgridApiKey || env.brevoApiKey || env.emailApiUrl
  );

  if (hasHttpConfig) {
    return sendViaHttpRest(mail);
  }

  if (transporter) {
    return Promise.race([
      transporter.sendMail(mail),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Email delivery timed out after ${emailDeliveryTimeoutMs}ms`,
              ),
            ),
          emailDeliveryTimeoutMs,
        ),
      ),
    ]);
  }

  throw new Error(
    'No email transport configured (set RESEND_API_KEY, SENDGRID_API_KEY, BREVO_API_KEY, EMAIL_API_URL, or SMTP_HOST)'
  );
}

