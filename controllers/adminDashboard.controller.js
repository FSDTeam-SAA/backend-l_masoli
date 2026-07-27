import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import User from '../models/user.model.js';
import { ROLES } from '../constants/index.js';
import { dashboardStats, registrationRate, userGrowth } from '../services/analytics.service.js';
import { formatDateLabel, relativeUpdatedLabel } from '../utils/labelHelper.js';

const decorateUser = (user) => ({
  ...(typeof user.toObject === 'function' ? user.toObject() : user),
  joiningDate: formatDateLabel(user.createdAt, 'UTC'),
  lastActiveLabel: relativeUpdatedLabel(user.lastActiveAt)
});

const fetchRecentUsers = async (limit) =>
  User.find({ isDeleted: false, role: ROLES.USER })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 5, 50));

export const getStats = catchAsync(async (req, res) => {
  const stats = await dashboardStats();

  sendResponse(res, { message: 'Dashboard stats retrieved successfully', data: stats });
});

export const getRegistrationRate = catchAsync(async (req, res) => {
  const data = await registrationRate({ week: req.query.week, start: req.query.start });

  sendResponse(res, { message: 'Registration rate retrieved successfully', data });
});

export const getUserGrowth = catchAsync(async (req, res) => {
  const data = await userGrowth(req.query.year);

  sendResponse(res, { message: 'User growth retrieved successfully', data });
});

export const getRecentUsers = catchAsync(async (req, res) => {
  const users = await fetchRecentUsers(req.query.limit);

  sendResponse(res, {
    message: 'Recent users retrieved successfully',
    data: users.map(decorateUser)
  });
});

export const getOverview = catchAsync(async (req, res) => {
  const [stats, registration, growth, recentUsers] = await Promise.all([
    dashboardStats(),
    registrationRate({ week: req.query.week }),
    userGrowth(req.query.year),
    fetchRecentUsers(req.query.limit || 9)
  ]);

  sendResponse(res, {
    message: 'Dashboard overview retrieved successfully',
    data: {
      stats,
      registrationRate: registration,
      userGrowth: growth,
      recentUsers: recentUsers.map(decorateUser)
    }
  });
});
