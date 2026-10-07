import { createHash, randomBytes } from "crypto";
import { env } from "../config/env.js";
import User from "../models/User.js";
import { sendEmail } from "../utils/email.js";
import { generateJwtToken } from "../utils/generateToken.js";

const passwordResetWindowMs = env.passwordResetTokenTtlMinutes * 60 * 1000;
const authOtpWindowMs = env.authOtpExpiresInMinutes * 60 * 1000;
const authOtpResendCooldownMs = env.authOtpResendCooldownSeconds * 1000;
const authOtpSelect =
  "+authOtpCodeHash +authOtpExpiresAt +authOtpPurpose +authOtpAttempts +lastOtpSentAt";

function buildClientUrl(path) {
  return `${env.clientUrl.replace(/\/$/, "")}${path}`;
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashResetToken(token) {
  return hashValue(token);
}

function createPasswordResetToken() {
  const token = randomBytes(32).toString("hex");

  return {
    rawToken: token,
    hashedToken: hashResetToken(token),
    expiresAt: new Date(Date.now() + passwordResetWindowMs),
  };
}

function createOtpCode() {
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    rawCode: code,
    hashedCode: hashValue(code),
    expiresAt: new Date(Date.now() + authOtpWindowMs),
  };
}

function buildAuthPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    walletBalance: user.walletBalance || 0,
  };
}

function clearAuthOtp(user) {
  user.authOtpCodeHash = undefined;
  user.authOtpExpiresAt = undefined;
  user.authOtpPurpose = undefined;
  user.authOtpAttempts = undefined;
  user.lastOtpSentAt = undefined;
}

function buildOtpChallengeResponse(user, purpose, emailDeliveryFailed = false) {
  const resendAvailableAt = user.lastOtpSentAt
    ? new Date(user.lastOtpSentAt.getTime() + authOtpResendCooldownMs)
    : null;

  return {
    requiresOtp: true,
    purpose,
    email: user.email,
    expiresAt: user.authOtpExpiresAt?.toISOString() || null,
    expiresInMinutes: env.authOtpExpiresInMinutes,
    resendAvailableAt: resendAvailableAt?.toISOString() || null,
    resendCooldownSeconds: env.authOtpResendCooldownSeconds,
    maxAttempts: env.authOtpMaxAttempts,
    emailDeliveryFailed,
  };
}

function getOtpChallengeMessage(purpose, emailDeliveryFailed) {
  if (emailDeliveryFailed) {
    return purpose === "signup"
      ? "Your account is ready for verification. If the OTP does not arrive, use resend to request a fresh code."
      : "Your login challenge is ready. If the OTP does not arrive, use resend to request a fresh code.";
  }

  return purpose === "signup"
    ? "We sent a verification OTP to your email address."
    : "We sent a login OTP to your email address.";
}

function getResendCooldownPayload(user) {
  if (!user.lastOtpSentAt) return null;

  const resendAvailableAt = new Date(
    user.lastOtpSentAt.getTime() + authOtpResendCooldownMs,
  );
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt.getTime() - Date.now()) / 1000),
  );

  return {
    resendAvailableAt: resendAvailableAt.toISOString(),
    retryAfterSeconds,
  };
}

function buildWelcomeEmail(user) {
  const dashboardUrl = buildClientUrl("/dashboard");
  const displayName = user.name || "there";

  return {
    subject: "Welcome to EventManager",
    text: [
      `Hi ${displayName},`,
      "",
      "Welcome to EventManager. Your account has been created successfully.",
      `Role: ${user.role}`,
      `Email: ${user.email}`,
      `Open your dashboard: ${dashboardUrl}`,
      "",
      "Thanks for joining us.",
      "",
      "EventManager Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Welcome</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">Thanks for signing up, ${displayName}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Your EventManager account is ready. You can now explore events, manage bookings, and track your activity from one place.</p>

          <div style="border-radius: 16px; background: #ecfeff; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 8px;"><strong>Name:</strong> ${displayName}</div>
            <div style="margin-bottom: 8px;"><strong>Email:</strong> ${user.email}</div>
            <div><strong>Role:</strong> ${user.role}</div>
          </div>

          <a href="${dashboardUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
            Open Dashboard
          </a>

          <p style="margin: 24px 0 0; font-size: 14px; color: #475569;">See you soon,<br />EventManager Team</p>
        </div>
      </div>
    `,
  };
}

function buildPasswordResetEmail(user, resetToken) {
  const resetUrl = buildClientUrl(
    `/reset-password?token=${encodeURIComponent(resetToken)}`,
  );
  const displayName = user.name || "there";

  return {
    subject: "Reset your EventManager password",
    text: [
      `Hi ${displayName},`,
      "",
      "We received a request to reset your password.",
      `Reset your password here: ${resetUrl}`,
      `This link expires in ${env.passwordResetTokenTtlMinutes} minutes.`,
      "",
      "If you did not request a password reset, you can ignore this email.",
      "",
      "EventManager Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Password Reset</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">Reset your password</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${displayName}, click the button below to set a new password for your EventManager account.</p>

          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600; margin-bottom: 20px;">
            Reset Password
          </a>

          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #475569;">This link expires in ${env.passwordResetTokenTtlMinutes} minutes.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">If the button does not work, paste this link into your browser:<br /><a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a></p>
        </div>
      </div>
    `,
  };
}

function buildOtpEmail(user, otpCode, purpose) {
  const displayName = user.name || "there";
  const label =
    purpose === "signup" ? "Verify your email" : "Login verification";
  const helperText =
    purpose === "signup"
      ? "Use this OTP to verify your email and finish creating your account."
      : "Use this OTP to complete your login securely.";

  return {
    subject: `${label} OTP for EventManager`,
    text: [
      `Hi ${displayName},`,
      "",
      helperText,
      `Your OTP is: ${otpCode}`,
      `This OTP expires in ${env.authOtpExpiresInMinutes} minutes.`,
      "",
      "If you did not request this code, you can ignore this email.",
      "",
      "EventManager Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">One-Time Password</div>
          <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">${label}</h1>
          <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6;">Hi ${displayName}, ${helperText.toLowerCase()}</p>

          <div style="margin: 0 0 20px; padding: 18px 20px; border-radius: 18px; background: #eff6ff; border: 1px solid #bfdbfe; text-align: center;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.2em; color: #64748b; margin-bottom: 10px;">Your OTP</div>
            <div style="font-size: 36px; font-weight: 700; letter-spacing: 0.35em; color: #1d4ed8;">${otpCode}</div>
          </div>

          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">This OTP expires in ${env.authOtpExpiresInMinutes} minutes. If you did not request it, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  };
}

async function sendWelcomeEmail(user) {
  try {
    await sendEmail({ to: user.email, ...buildWelcomeEmail(user) });
  } catch (error) {
    console.error(
      `Failed to send welcome email to ${user.email}: ${error.message}`,
    );
  }
}

async function issueOtpChallenge(user, purpose) {
  const { rawCode, hashedCode, expiresAt } = createOtpCode();
  const sentAt = new Date();
  const hasMailTransport = Boolean(
    (env.smtpHost && env.emailFrom) ||
      env.resendApiKey ||
      env.sendgridApiKey ||
      env.brevoApiKey ||
      env.emailApiUrl,
  );

  user.authOtpCodeHash = hashedCode;
  user.authOtpExpiresAt = expiresAt;
  user.authOtpPurpose = purpose;
  user.authOtpAttempts = 0;
  user.lastOtpSentAt = sentAt;
  await user.save({ validateBeforeSave: false });

  let emailDeliveryFailed = false;

  try {
    await sendEmail({
      to: user.email,
      ...buildOtpEmail(user, rawCode, purpose),
    });
  } catch (error) {
    emailDeliveryFailed = true;
    console.error(
      `Failed to send ${purpose} OTP email to ${user.email}: ${error.message}`,
    );
  }

  if (env.nodeEnv === "development" && !hasMailTransport) {
    console.log(`[DEV ONLY - OTP] Code for ${user.email}: ${rawCode}`);
  }

  const response = buildOtpChallengeResponse(
    user,
    purpose,
    emailDeliveryFailed,
  );

  // Expose OTP in API response ONLY during local development without mail transport
  if (env.nodeEnv === "development" && !hasMailTransport) {
    response.otpCode = rawCode;
  }

  return response;
}

export const signup = async (req, res) => {
  let user;

  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    const role = req.body?.role || "customer";

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    user = await User.create({
      name,
      email,
      password,
      role,
      isEmailVerified: false,
    });

    const otpPayload = await issueOtpChallenge(user, "signup");

    return res.status(201).json({
      ...otpPayload,
      message: getOtpChallengeMessage("signup", otpPayload.emailDeliveryFailed),
    });
  } catch (err) {
    if (user?._id) {
      await User.findByIdAndDelete(user._id);
    }
    return res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;
    const user = await User.findOne({ email }).select(
      `+password ${authOtpSelect}`,
    );

    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    if (user.isBlocked)
      return res.status(403).json({ message: "User is blocked" });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const purpose = user.isEmailVerified ? "login" : "signup";
    const otpPayload = await issueOtpChallenge(user, purpose);

    return res.json({
      ...otpPayload,
      message:
        purpose === "signup"
          ? otpPayload.emailDeliveryFailed
            ? "Your email is not verified yet. If the OTP does not arrive, use resend to request a fresh code."
            : "Your email is not verified yet. We sent a verification OTP."
          : getOtpChallengeMessage("login", otpPayload.emailDeliveryFailed),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const otp = req.body?.otp?.trim();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email }).select(authOtpSelect);
    if (!user || !user.authOtpCodeHash || !user.authOtpPurpose) {
      return res.status(400).json({ message: "Invalid OTP session" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    if ((user.authOtpAttempts || 0) >= env.authOtpMaxAttempts) {
      return res.status(429).json({
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    if (!user.authOtpExpiresAt || user.authOtpExpiresAt <= new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (hashValue(otp) !== user.authOtpCodeHash) {
      user.authOtpAttempts = (user.authOtpAttempts || 0) + 1;
      await user.save({ validateBeforeSave: false });

      if (user.authOtpAttempts >= env.authOtpMaxAttempts) {
        return res.status(429).json({
          message: "Too many incorrect attempts. Please request a new OTP.",
        });
      }

      return res.status(400).json({ message: "Incorrect OTP" });
    }

    const purpose = user.authOtpPurpose;
    if (purpose === "signup") {
      user.isEmailVerified = true;
    }

    clearAuthOtp(user);
    await user.save({ validateBeforeSave: false });

    if (purpose === "signup") {
      void sendWelcomeEmail(user);
    }

    const token = generateJwtToken({
      id: user._id,
      role: user.role,
      name: user.name,
    });
    return res.json({
      token,
      user: buildAuthPayload(user),
      message:
        purpose === "signup"
          ? "Email verified successfully."
          : "Login verified successfully.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select(authOtpSelect);
    if (!user || !user.authOtpCodeHash || !user.authOtpPurpose) {
      return res.status(400).json({
        message: "OTP session is invalid or has expired.",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    if (user.authOtpPurpose === "signup" && user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    const resendCooldown = getResendCooldownPayload(user);
    if (resendCooldown && resendCooldown.retryAfterSeconds > 0) {
      return res.status(429).json({
        message: "Wait before requesting again",
        ...resendCooldown,
      });
    }

    const otpPayload = await issueOtpChallenge(user, user.authOtpPurpose);

    return res.json({
      ...otpPayload,
      message: otpPayload.emailDeliveryFailed
        ? "A fresh OTP was generated. If it does not arrive, try resend again shortly."
        : "A new OTP has been sent to your email address.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const genericMessage =
    "If an account exists for that email, a password reset link has been sent.";

  try {
    const email = req.body?.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: genericMessage });

    const { rawToken, hashedToken, expiresAt } = createPasswordResetToken();
    user.passwordResetToken = hashedToken;
    user.passwordResetExpiresAt = expiresAt;
    await user.save({ validateBeforeSave: false });

    const resetUrl = buildClientUrl(
      `/reset-password?token=${encodeURIComponent(rawToken)}`,
    );

    let emailDeliveryFailed = false;

    try {
      await sendEmail({
        to: user.email,
        ...buildPasswordResetEmail(user, rawToken),
      });
    } catch (error) {
      console.error(
        `Failed to send password reset email to ${user.email}: ${error.message}`,
      );
      if (env.nodeEnv === "development" || !env.smtpHost) {
        console.log(`[DEV/SERVER LOG ONLY] Password reset link for ${user.email}: ${resetUrl}`);
      }
    }

    return res.json({ message: genericMessage });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const verifyResetPasswordToken = async (req, res) => {
  try {
    const token = req.params?.token;
    if (!token)
      return res.status(400).json({ message: "Reset token is required" });

    const hashedToken = hashResetToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("_id");

    if (!user) {
      return res
        .status(400)
        .json({ message: "This reset link is invalid or has expired." });
    }

    return res.json({ message: "Reset link verified." });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password;

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = hashResetToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "This reset link is invalid or has expired." });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    return res.json({
      message:
        "Password reset successful. Please log in with your new password.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: "Not found" });
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        walletBalance: user.walletBalance || 0,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
