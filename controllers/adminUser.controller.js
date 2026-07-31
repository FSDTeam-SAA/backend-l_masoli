import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import User from '../models/user.model.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import { ROLES, SUBSCRIPTION_TIER, USER_STATUS } from '../constants/index.js';
import { userStats } from '../services/analytics.service.js';
import { revokeAllRefreshTokens } from '../services/auth.service.js';
import { formatDateLabel, relativeUpdatedLabel } from '../utils/labelHelper.js';

const decorateUser = (user) => {
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;

  return {
    ...plain,
    joiningDate: formatDateLabel(plain.createdAt, 'UTC'),
    lastActiveLabel: relativeUpdatedLabel(plain.lastActiveAt)
  };
};

const findManageableUser = async (id, actor) => {
  const user = await User.findOne({ _id: id, isDeleted: false });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (user.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot manage a super admin account');
  }

  if (user._id.equals(actor._id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot perform this action on your own account');
  }

  return user;
};

export const listUsers = catchAsync(async (req, res) => {
  const query = { ...req.query };

  if (!query.role || query.role === 'all') delete query.role;
  if (!query.status || query.status === 'all') delete query.status;

  const builder = new QueryBuilder(User.find({ isDeleted: false }), query)
    .search(['userName', 'email', 'firstName', 'lastName', 'phone'])
    .filter()
    .sort('-createdAt')
    .paginate();

  const [users, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  sendResponse(res, {
    message: 'Users retrieved successfully',
    meta,
    data: users.map(decorateUser)
  });
});

export const getUser = catchAsync(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, isDeleted: false });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const stats = await userStats(user._id);

  sendResponse(res, {
    message: 'User retrieved successfully',
    data: { ...decorateUser(user), age: user.age, stats }
  });
});

export const createUser = catchAsync(async (req, res) => {
  const existing = await User.findOne({ email: req.body.email });

  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'An account with this email already exists');
  }

  const user = await User.create({
    ...pick(req.body, ['userName', 'email', 'phone', 'password', 'role']),
    isEmailVerified: true
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'User created successfully',
    data: decorateUser(user)
  });
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await findManageableUser(req.params.id, req.user);

  Object.assign(
    user,
    pick(req.body, ['userName', 'firstName', 'lastName', 'phone', 'bio', 'dateOfBirth', 'status'])
  );
  await user.save();

  sendResponse(res, { message: 'User updated successfully', data: decorateUser(user) });
});

export const updateUserStatus = catchAsync(async (req, res) => {
  const user = await findManageableUser(req.params.id, req.user);

  user.status = req.body.status;
  await user.save();

  if (user.status === USER_STATUS.INACTIVE) {
    await revokeAllRefreshTokens(user._id);
  }

  sendResponse(res, {
    message: `User ${user.status === USER_STATUS.ACTIVE ? 'activated' : 'deactivated'} successfully`,
    data: decorateUser(user)
  });
});

export const updateUserRole = catchAsync(async (req, res) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Only a super admin can change roles');
  }

  const user = await findManageableUser(req.params.id, req.user);

  user.role = req.body.role;
  await user.save();

  sendResponse(res, { message: 'User role updated successfully', data: decorateUser(user) });
});

export const updateUserSubscription = catchAsync(async (req, res) => {
  const user = await findManageableUser(req.params.id, req.user);
  const { tier, expiresAt } = req.body;

  user.subscription = {
    tier,
    source: tier === SUBSCRIPTION_TIER.PREMIUM ? 'manual' : 'none',
    startedAt: tier === SUBSCRIPTION_TIER.PREMIUM ? user.subscription?.startedAt || new Date() : null,
    expiresAt: tier === SUBSCRIPTION_TIER.PREMIUM ? expiresAt || null : null
  };

  await user.save();

  sendResponse(res, {
    message: `User moved to the ${tier} plan`,
    data: decorateUser(user)
  });
});

export const deleteUser = catchAsync(async (req, res) => {
  const user = await findManageableUser(req.params.id, req.user);

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.email = `deleted_${user._id}_${user.email}`;
  await user.save();

  await Promise.all([
    Goal.updateMany({ user: user._id }, { isDeleted: true }),
    Milestone.updateMany({ user: user._id }, { isDeleted: true }),
    VisionBoard.updateMany({ user: user._id }, { isDeleted: true }),
    revokeAllRefreshTokens(user._id)
  ]);

  sendResponse(res, { message: 'User deleted successfully' });
});
