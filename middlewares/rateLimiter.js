import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import env from '../config/env.js';

const rateLimiter = (options = {}) =>
  rateLimit({
    windowMs: options.windowMs || env.RATE_LIMIT_WINDOW_MS,
    max: options.max || env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    skip: () => env.NODE_ENV === 'test',
    handler: (req, res) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: options.message || 'Too many requests. Please try again later'
      });
    }
  });

export const emailKeyGenerator = (req, res, ip) => {
  const email = req.body?.email ? String(req.body.email).toLowerCase() : '';
  return email ? `${ip}:${email}` : ip;
};

export default rateLimiter;
