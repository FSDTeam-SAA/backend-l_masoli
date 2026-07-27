import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

export const signResetToken = (payload) =>
  jwt.sign(payload, env.JWT_RESET_SECRET, { expiresIn: env.JWT_RESET_EXPIRES_IN });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

export const verifyResetToken = (token) => jwt.verify(token, env.JWT_RESET_SECRET);

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const createAuthTokens = (user) => {
  const payload = { id: user._id.toString(), email: user.email, role: user.role };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
};
