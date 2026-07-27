import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import env from '../config/env.js';
import User from '../models/user.model.js';
import DeviceToken from '../models/deviceToken.model.js';
import { OTP_TYPE, USER_STATUS, ACTIVITY_TYPE, ROLES } from '../constants/index.js';
import { createAuthTokens, signResetToken, verifyRefreshToken, verifyResetToken } from '../utils/token.js';
import { sendPasswordChangedEmail, sendWelcomeEmail } from '../utils/email.js';
import { logActivity } from '../services/activity.service.js';
import { notifyAdmins } from '../services/notification.service.js';
import {
  issueOtp,
  verifyOtpCode,
  consumeOtp,
  attachResetJti,
  assertResetJti,
  persistRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  assertRefreshTokenIsActive
} from '../services/auth.service.js';

const publicUser = (user) => ({
  _id: user._id,
  userName: user.userName,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  bio: user.bio,
  timezone: user.timezone,
  status: user.status,
  isEmailVerified: user.isEmailVerified,
  notificationSettings: user.notificationSettings,
  createdAt: user.createdAt
});

const registerDeviceToken = async ({ userId, token, platform }) => {
  if (!token) return;

  await DeviceToken.findOneAndUpdate(
    { token },
    { user: userId, token, platform: platform || 'android', lastUsedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const register = catchAsync(async (req, res) => {
  const { email, password, phone, timezone, firstName, lastName } = req.body;
  const userName = req.body.userName || [firstName, lastName].filter(Boolean).join(' ');

  const existing = await User.findOne({ email });

  if (existing && existing.isEmailVerified) {
    throw new ApiError(StatusCodes.CONFLICT, 'An account with this email already exists');
  }

  if (existing) {
    existing.userName = userName;
    existing.firstName = firstName || existing.firstName;
    existing.lastName = lastName || existing.lastName;
    existing.phone = phone || existing.phone;
    existing.password = password;
    if (timezone) existing.timezone = timezone;
    await existing.save();
  } else {
    await User.create({
      userName,
      firstName: firstName || '',
      lastName: lastName || '',
      email,
      phone: phone || '',
      password,
      timezone: timezone || 'UTC'
    });
  }

  const otpMeta = await issueOtp({ email, type: OTP_TYPE.EMAIL_VERIFICATION });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Account created. Please verify the code sent to your email',
    data: otpMeta
  });
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email, isDeleted: false });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No account found for this email');
  }

  await verifyOtpCode({ email, otp, type: OTP_TYPE.EMAIL_VERIFICATION });
  await consumeOtp({ email, type: OTP_TYPE.EMAIL_VERIFICATION });

  const wasUnverified = !user.isEmailVerified;
  user.isEmailVerified = true;
  await user.save();

  const tokens = createAuthTokens(user);
  await persistRefreshToken({ user, refreshToken: tokens.refreshToken, req });

  if (wasUnverified) {
    await sendWelcomeEmail({ to: user.email, userName: user.userName });
    await notifyAdmins({
      title: 'New user joined',
      body: `${user.userName} just created an account`,
      type: 'new_user',
      data: { userId: user._id.toString() }
    });
  }

  sendResponse(res, {
    message: 'Email verified successfully',
    data: { user: publicUser(user), ...tokens }
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password, deviceToken, platform, timezone } = req.body;

  const user = await User.findOne({ email, isDeleted: false }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Incorrect email or password');
  }

  if (!user.isEmailVerified) {
    await issueOtp({ email, type: OTP_TYPE.EMAIL_VERIFICATION }).catch(() => {});

    return sendResponse(res, {
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Please verify your email to continue',
      data: { needsVerification: true, email }
    });
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Your account is inactive. Please contact support');
  }

  if (timezone) {
    user.timezone = timezone;
  }
  user.lastActiveAt = new Date();
  await user.save();

  const tokens = createAuthTokens(user);
  await persistRefreshToken({ user, refreshToken: tokens.refreshToken, req });
  await registerDeviceToken({ userId: user._id, token: deviceToken, platform });
  await logActivity({ user, type: ACTIVITY_TYPE.LOGIN });

  sendResponse(res, {
    message: 'Signed in successfully',
    data: { user: publicUser(user), ...tokens }
  });
});

export const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken: incoming } = req.body;

  const decoded = verifyRefreshToken(incoming);
  await assertRefreshTokenIsActive(incoming);

  const user = await User.findById(decoded.id);

  if (!user || user.isDeleted || user.status !== USER_STATUS.ACTIVE) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired. Please sign in again');
  }

  const tokens = createAuthTokens(user);
  await revokeRefreshToken(incoming);
  await persistRefreshToken({ user, refreshToken: tokens.refreshToken, req });

  sendResponse(res, {
    message: 'Token refreshed successfully',
    data: tokens
  });
});

export const logout = catchAsync(async (req, res) => {
  const { refreshToken: incoming, deviceToken } = req.body;

  await revokeRefreshToken(incoming);

  if (deviceToken) {
    await DeviceToken.deleteOne({ token: deviceToken, user: req.user._id });
  }

  sendResponse(res, { message: 'Signed out successfully' });
});

export const logoutAll = catchAsync(async (req, res) => {
  await revokeAllRefreshTokens(req.user._id);
  await DeviceToken.deleteMany({ user: req.user._id });

  sendResponse(res, { message: 'Signed out from all devices' });
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email, isDeleted: false });

  if (user) {
    await issueOtp({ email, type: OTP_TYPE.PASSWORD_RESET });
  }

  sendResponse(res, {
    message: 'If an account exists for this email, a verification code has been sent',
    data: {
      email,
      expiresIn: env.OTP_EXPIRES_MINUTES * 60,
      resendAfter: env.OTP_RESEND_COOLDOWN_SECONDS
    }
  });
});

export const resendOtp = catchAsync(async (req, res) => {
  const { email, type } = req.body;

  const user = await User.findOne({ email, isDeleted: false });

  if (!user) {
    return sendResponse(res, {
      message: 'If an account exists for this email, a verification code has been sent',
      data: {
        email,
        expiresIn: env.OTP_EXPIRES_MINUTES * 60,
        resendAfter: env.OTP_RESEND_COOLDOWN_SECONDS
      }
    });
  }

  const otpMeta = await issueOtp({ email, type, isResend: true });

  sendResponse(res, {
    message: 'A new verification code has been sent',
    data: otpMeta
  });
});

export const verifyOtp = catchAsync(async (req, res) => {
  const { email, otp, type } = req.body;

  const user = await User.findOne({ email, isDeleted: false });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No account found for this email');
  }

  const record = await verifyOtpCode({ email, otp, type });

  if (type === OTP_TYPE.EMAIL_VERIFICATION) {
    await consumeOtp({ email, type });
    user.isEmailVerified = true;
    await user.save();

    const tokens = createAuthTokens(user);
    await persistRefreshToken({ user, refreshToken: tokens.refreshToken, req });

    return sendResponse(res, {
      message: 'Email verified successfully',
      data: { user: publicUser(user), ...tokens }
    });
  }

  const jti = await attachResetJti(record);
  const resetToken = signResetToken({ id: user._id.toString(), email: user.email, jti });

  sendResponse(res, {
    message: 'Code verified. You can now reset your password',
    data: { resetToken, expiresIn: env.JWT_RESET_EXPIRES_IN }
  });
});

export const resetPassword = catchAsync(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  const decoded = verifyResetToken(resetToken);
  await assertResetJti({ email: decoded.email, jti: decoded.jti });

  const user = await User.findById(decoded.id).select('+password');

  if (!user || user.isDeleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'No account found for this email');
  }

  if (await user.comparePassword(newPassword)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'New password must be different from the current one');
  }

  user.password = newPassword;
  await user.save();

  await consumeOtp({ email: decoded.email, type: OTP_TYPE.PASSWORD_RESET });
  await revokeAllRefreshTokens(user._id);
  await sendPasswordChangedEmail({ to: user.email, userName: user.userName });

  sendResponse(res, { message: 'Password reset successfully. Please sign in again' });
});

export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'New password must be different from the current one');
  }

  user.password = newPassword;
  await user.save();

  await revokeAllRefreshTokens(user._id);
  await sendPasswordChangedEmail({ to: user.email, userName: user.userName });

  sendResponse(res, { message: 'Password changed successfully. Please sign in again' });
});

export { publicUser, registerDeviceToken, ROLES };
