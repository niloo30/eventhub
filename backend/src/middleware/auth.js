import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function resolveAuthenticatedUser(req, { optional = false } = {}) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    if (optional) return null;
    throw createHttpError(401, 'Unauthorized');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw createHttpError(401, 'Invalid token');
  }

  const userId = decoded.id || decoded._id;
  if (!userId) throw createHttpError(401, 'Unauthorized');

  const user = await User.findById(userId)
    .select('name email role isBlocked')
    .lean();

  if (!user) throw createHttpError(401, 'Unauthorized');
  if (user.isBlocked) throw createHttpError(403, 'User is blocked');

  return {
    id: user._id.toString(),
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function authenticate(req, res, next) {
  try {
    req.user = await resolveAuthenticatedUser(req);
    next();
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function optionalAuthenticate(req, res, next) {
  try {
    const user = await resolveAuthenticatedUser(req, { optional: true });
    if (user) req.user = user;
    next();
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

