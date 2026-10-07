import dotenv from "dotenv";

dotenv.config();

function normalizeUrl(value = "") {
  return value.trim().replace(/\/+$/, "");
}

function escapeRegex(value = "") {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function parseClientUrls(...values) {
  const uniqueUrls = new Set();

  for (const value of values) {
    if (!value) continue;

    for (const entry of value.split(",")) {
      const normalizedEntry = normalizeUrl(entry);
      if (normalizedEntry) uniqueUrls.add(normalizedEntry);
    }
  }

  return [...uniqueUrls];
}

function compileOriginPatterns(urls = []) {
  return urls
    .filter((url) => url.includes("*"))
    .map((url) => {
      const regexPattern = `^${escapeRegex(url).replace(/\*/g, ".*")}$`;
      return new RegExp(regexPattern);
    });
}

function isLoopbackOrigin(origin = "") {
  if (!origin) return false;

  try {
    const { hostname } = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

const defaultClientUrls = ["http://localhost:5173"];
const clientUrls = parseClientUrls(
  process.env.CLIENT_URLS,
  process.env.CLIENT_URL,
);
const allowedClientUrls = clientUrls.length ? clientUrls : defaultClientUrls;
const allowedClientOriginPatterns = compileOriginPatterns(allowedClientUrls);
// Choose a single primary client URL. If `CLIENT_URL` contains multiple
// comma-separated values, prefer the first parsed entry from `clientUrls`.
const primaryClientUrl =
  (process.env.CLIENT_URL &&
    !process.env.CLIENT_URL.includes(",") &&
    normalizeUrl(process.env.CLIENT_URL)) ||
  clientUrls[0] ||
  allowedClientUrls.find(
    (url) =>
      !url.includes("*") &&
      !["localhost", "127.0.0.1"].some((host) => url.includes(host)),
  ) ||
  allowedClientUrls.find((url) => !url.includes("*")) ||
  allowedClientUrls[0];

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5050),

  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  authOtpExpiresInMinutes: Number(process.env.AUTH_OTP_EXPIRES_IN_MINUTES || 5),
  authOtpMaxAttempts: Number(process.env.AUTH_OTP_MAX_ATTEMPTS || 5),
  authOtpResendCooldownSeconds: Number(
    process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS || 60,
  ),
  allowOtpFallback: String(process.env.ALLOW_OTP_FALLBACK || "").toLowerCase() === "true",

  clientUrl: primaryClientUrl,
  clientUrls: allowedClientUrls,

  passwordResetTokenTtlMinutes: Number(
    process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30,
  ),

  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,

  emailApiUrl: process.env.EMAIL_API_URL,
  emailApiKey: process.env.EMAIL_API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,

  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "event-manager",

  redisUrl: process.env.REDIS_URL || "",
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || "",

  ticketHoldMinutes: Number(process.env.TICKET_HOLD_MINUTES || 8),
  eventReminderLookaheadHours: Number(process.env.EVENT_REMINDER_LOOKAHEAD_HOURS || 24),
  eventReminderIntervalMinutes: Number(process.env.EVENT_REMINDER_INTERVAL_MINUTES || 60),
  elasticUrl: process.env.ELASTIC_URL || "",
  razorpayWebhookSecret:
    process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "",
};

export function isAllowedClientOrigin(origin) {
  const normalizedOrigin = normalizeUrl(origin || "");
  return (
    !normalizedOrigin ||
    isLoopbackOrigin(normalizedOrigin) ||
    env.clientUrls.includes(normalizedOrigin) ||
    allowedClientOriginPatterns.some((pattern) =>
      pattern.test(normalizedOrigin),
    )
  );
}

export default env;
