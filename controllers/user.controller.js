import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import User from '../models/user.model.js';
import Goal from '../models/goal.model.js';
import { uploadToCloudinary, deleteFromCloudinary, toImagePayload } from '../utils/cloudinary.js';
import { BILLING_PERIOD, CLOUDINARY_FOLDERS, GOAL_STATUS, SUBSCRIPTION_TIER } from '../constants/index.js';
import { userStats } from '../services/analytics.service.js';
import { planSnapshot } from '../services/plan.service.js';
import { revokeAllRefreshTokens } from '../services/auth.service.js';
import { formatDateLabel } from '../utils/labelHelper.js';

export const getMe = catchAsync(async (req, res) => {
  sendResponse(res, {
    message: 'Profile retrieved successfully',
    data: req.user
  });
});

export const updateMe = catchAsync(async (req, res) => {
  const payload = pick(req.body, [
    'userName',
    'firstName',
    'lastName',
    'phone',
    'bio',
    'dateOfBirth',
    'timezone'
  ]);

  const user = await User.findById(req.user._id);
  Object.assign(user, payload);
  await user.save();

  sendResponse(res, {
    message: 'Profile updated successfully',
    data: user
  });
});

export const updateAvatar = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please upload an image file');
  }

  const user = await User.findById(req.user._id);
  const previousPublicId = user.avatar?.publicId;

  const result = await uploadToCloudinary(req.file.buffer, CLOUDINARY_FOLDERS.AVATARS);
  const image = toImagePayload(result);

  user.avatar = { url: image.url, publicId: image.publicId };
  await user.save();

  if (previousPublicId) {
    await deleteFromCloudinary(previousPublicId);
  }

  sendResponse(res, {
    message: 'Avatar updated successfully',
    data: user
  });
});

export const removeAvatar = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user.avatar?.publicId) {
    await deleteFromCloudinary(user.avatar.publicId);
  }

  user.avatar = { url: '', publicId: '' };
  await user.save();

  sendResponse(res, {
    message: 'Avatar removed successfully',
    data: user
  });
});

export const getMyStats = catchAsync(async (req, res) => {
  const stats = await userStats(req.user._id);

  sendResponse(res, {
    message: 'Stats retrieved successfully',
    data: stats
  });
});

export const getMySubscription = catchAsync(async (req, res) => {
  const snapshot = await planSnapshot(req.user);

  sendResponse(res, {
    message: 'Subscription retrieved successfully',
    data: snapshot
  });
});

// Placeholder "subscribe" — flips the stored tier and answers with the same
// planSnapshot GET /me/subscription returns, so the client can swap its local
// plan state from one response. There is deliberately NO payment here yet:
// when RevenueCat / Apple IAP / Play Billing land, this handler keeps its
// route and response shape and gains receipt verification before the save,
// so nothing downstream (plan gating, the app's Subscription screen) has to
// be restructured.
export const updateMySubscription = catchAsync(async (req, res) => {
  const { tier, billingPeriod } = req.body;

  const user = await User.findById(req.user._id);

  if (tier === SUBSCRIPTION_TIER.PREMIUM) {
    const startedAt = new Date();
    // Matches whichever product the app offered ($5.99/month or $49.99/year).
    // Real billing will replace this with the period the store reports.
    const expiresAt = new Date(startedAt);
    if (billingPeriod === BILLING_PERIOD.ANNUAL) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    user.subscription = { tier, billingPeriod, source: 'manual', startedAt, expiresAt };
  } else {
    user.subscription = {
      tier: SUBSCRIPTION_TIER.FREE,
      billingPeriod: null,
      source: 'none',
      startedAt: null,
      expiresAt: null
    };
  }

  await user.save();

  const snapshot = await planSnapshot(user);

  sendResponse(res, {
    message: tier === SUBSCRIPTION_TIER.PREMIUM ? 'Premium plan activated' : 'Switched to the Free plan',
    data: snapshot
  });
});

export const getMyCompletedGoals = catchAsync(async (req, res) => {
  const builder = new QueryBuilder(
    Goal.find({ user: req.user._id, isDeleted: false, status: GOAL_STATUS.COMPLETED })
      .populate('areaOfLife', 'name slug color icon')
      .populate('priority', 'name slug color weight'),
    req.query
  )
    .sort('-completedAt')
    .paginate();

  const [goals, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  const data = goals.map((goal) => ({
    ...goal.toObject(),
    completedAtLabel: formatDateLabel(goal.completedAt, req.user.timezone),
    targetDateLabel: formatDateLabel(goal.targetDate, req.user.timezone)
  }));

  sendResponse(res, {
    message: data.length > 0 ? 'Completed goals retrieved successfully' : 'No completed goals yet',
    meta,
    data
  });
});

export const deleteMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(req.body.password))) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password is incorrect');
  }

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.email = `deleted_${user._id}_${user.email}`;
  await user.save();

  await revokeAllRefreshTokens(user._id);

  sendResponse(res, { message: 'Your account has been deleted' });
});
