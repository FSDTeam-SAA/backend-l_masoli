import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import { verifyAccessToken } from '../utils/token.js';
import { USER_STATUS } from '../constants/index.js';

const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

const auth = (...allowedRoles) =>
  catchAsync(async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'You are not authorized to access this resource');
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);

    if (!user || user.isDeleted) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'This account no longer exists');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Your account is inactive. Please contact support');
    }

    if (user.isPasswordChangedAfter(decoded.iat)) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Password was recently changed. Please sign in again');
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have permission to perform this action');
    }

    const lastActive = user.lastActiveAt ? user.lastActiveAt.getTime() : 0;
    if (Date.now() - lastActive > LAST_ACTIVE_THROTTLE_MS) {
      User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
    }

    req.user = user;
    next();
  });

export default auth;
