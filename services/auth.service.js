import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import Otp from '../models/otp.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import { generateOtp, hashOtp, compareOtp } from '../utils/otp.js';
import { sendOtpEmail } from '../utils/email.js';
import { hashToken, verifyRefreshToken } from '../utils/token.js';

export const issueOtp = async ({ email, type, isResend = false }) => {
  const existing = await Otp.findOne({ email, type }).sort({ createdAt: -1 });

  if (existing && existing.lastSentAt) {
    const elapsedSeconds = Math.floor((Date.now() - existing.lastSentAt.getTime()) / 1000);
    const remaining = env.OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;

    if (remaining > 0) {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        `Please wait ${remaining} seconds before requesting another code`
      );
    }

    if (isResend && existing.resendCount >= env.OTP_MAX_RESENDS) {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        'Resend limit reached. Please try again in a few minutes'
      );
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000);
  const resendCount = isResend && existing ? existing.resendCount + 1 : 0;

  await Otp.findOneAndUpdate(
    { email, type },
    {
      email,
      type,
      otpHash: hashOtp(otp),
      expiresAt,
      attempts: 0,
      verifiedAt: null,
      resetJti: null,
      lastSentAt: new Date(),
      resendCount
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtpEmail({ to: email, otp, purpose: type });

  return {
    email,
    expiresIn: env.OTP_EXPIRES_MINUTES * 60,
    resendAfter: env.OTP_RESEND_COOLDOWN_SECONDS
  };
};

export const verifyOtpCode = async ({ email, otp, type }) => {
  const record = await Otp.findOne({ email, type });

  if (!record) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No verification code found. Please request a new one');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id });
    throw new ApiError(StatusCodes.BAD_REQUEST, 'This code has expired. Please request a new one');
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Too many failed attempts. Please request a new code');
  }

  if (!compareOtp(otp, record.otpHash)) {
    record.attempts += 1;
    await record.save();

    const remaining = Math.max(env.OTP_MAX_ATTEMPTS - record.attempts, 0);
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining`
    );
  }

  record.verifiedAt = new Date();
  await record.save();

  return record;
};

export const consumeOtp = async ({ email, type }) => {
  await Otp.deleteMany({ email, type });
};

export const attachResetJti = async (record) => {
  const jti = crypto.randomUUID();
  record.resetJti = jti;
  await record.save();

  return jti;
};

export const assertResetJti = async ({ email, jti }) => {
  const record = await Otp.findOne({ email, resetJti: jti });

  if (!record || !record.verifiedAt) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'This reset link is no longer valid. Please start again');
  }

  return record;
};

export const persistRefreshToken = async ({ user, refreshToken, req }) => {
  const decoded = verifyRefreshToken(refreshToken);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
    userAgent: req.headers['user-agent'] || '',
    ip: req.ip || ''
  });
};

export const revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;

  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { revokedAt: new Date() }
  );
};

export const revokeAllRefreshTokens = async (userId) => {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
};

export const assertRefreshTokenIsActive = async (refreshToken) => {
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });

  if (!stored || stored.revokedAt) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired. Please sign in again');
  }

  return stored;
};
