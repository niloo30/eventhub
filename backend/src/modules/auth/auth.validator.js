import validator from "validator";

const allowedSignupRoles = new Set(["customer", "organizer"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sendValidationError(res, errors) {
  return res.status(400).json({
    message: errors[0],
    errors,
  });
}

export function validateSignup(req, res, next) {
  const name = normalizeText(req.body?.name);
  const email = normalizeText(req.body?.email).toLowerCase();
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const role = normalizeText(req.body?.role) || "customer";
  const errors = [];

  if (!name || name.length < 2) {
    errors.push("Name must be at least 2 characters long.");
  }

  if (!validator.isEmail(email || "")) {
    errors.push("Please provide a valid email address.");
  }

  if (!validator.isLength(password, { min: 6 })) {
    errors.push("Password must be at least 6 characters long.");
  }

  if (!allowedSignupRoles.has(role)) {
    errors.push("Role must be either customer or organizer.");
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = {
    ...req.body,
    name,
    email,
    password,
    role,
  };

  next();
}

export function validateLogin(req, res, next) {
  const email = normalizeText(req.body?.email).toLowerCase();
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const errors = [];

  if (!validator.isEmail(email || "")) {
    errors.push("Please provide a valid email address.");
  }

  if (!password) {
    errors.push("Password is required.");
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = {
    ...req.body,
    email,
    password,
  };

  next();
}

export function validateVerifyOtp(req, res, next) {
  const email = normalizeText(req.body?.email).toLowerCase();
  const otp = normalizeText(req.body?.otp);
  const errors = [];

  if (!validator.isEmail(email || "")) {
    errors.push("Please provide a valid email address.");
  }

  if (!/^\d{6}$/.test(otp)) {
    errors.push("OTP must be a 6-digit code.");
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = {
    ...req.body,
    email,
    otp,
  };

  next();
}

export function validateResendOtp(req, res, next) {
  const email = normalizeText(req.body?.email).toLowerCase();

  if (!validator.isEmail(email || "")) {
    return sendValidationError(res, ["Please provide a valid email address."]);
  }

  req.body = {
    ...req.body,
    email,
  };

  next();
}

export function validateForgotPassword(req, res, next) {
  const email = normalizeText(req.body?.email).toLowerCase();

  if (!validator.isEmail(email || "")) {
    return sendValidationError(res, ["Please provide a valid email address."]);
  }

  req.body = {
    ...req.body,
    email,
  };

  next();
}

export function validateResetPasswordToken(req, res, next) {
  const token = normalizeText(req.params?.token);

  if (!token) {
    return sendValidationError(res, ["Reset token is required."]);
  }

  req.params = {
    ...req.params,
    token,
  };

  next();
}

export function validateResetPassword(req, res, next) {
  const token = normalizeText(req.body?.token);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const errors = [];

  if (!token) {
    errors.push("Reset token is required.");
  }

  if (!validator.isLength(password, { min: 6 })) {
    errors.push("Password must be at least 6 characters long.");
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = {
    ...req.body,
    token,
    password,
  };

  next();
}
