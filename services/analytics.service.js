import mongoose from 'mongoose';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import BoardImage from '../models/boardImage.model.js';
import UserBadge from '../models/userBadge.model.js';
import User from '../models/user.model.js';
import ProgressSnapshot from '../models/progressSnapshot.model.js';
import env from '../config/env.js';
import {
  ACTIVE_USER_WINDOW_DAYS,
  CHART_RANGE,
  GOAL_STATUS,
  ROLES,
  USER_STATUS
} from '../constants/index.js';
import {
  addDays,
  buildDailyBuckets,
  buildMonthlyBuckets,
  buildWeeklyBuckets,
  buildYearMonthBuckets,
  dayKey,
  dayKeyToUtcDate,
  safeTimezone,
  shiftDayKey,
  startOfWeekDayKey,
  weekRangeFromDayKey,
  zeroFill
} from '../utils/dateHelper.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const percentage = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

const changePercent = (current, previous) =>
  Math.round(((current - previous) / Math.max(previous, 1)) * 100);

export const overallProgress = async (userId) => {
  const [row] = await Goal.aggregate([
    { $match: { user: toObjectId(userId), isDeleted: false, status: { $ne: GOAL_STATUS.ARCHIVED } } },
    { $group: { _id: null, average: { $avg: '$progress' }, count: { $sum: 1 } } }
  ]);

  if (!row || row.count === 0) return 0;

  return Math.round(row.average);
};

export const userStats = async (userId) => {
  const id = toObjectId(userId);

  const [goals, completedGoals, activeGoals, boards, totalMilestones, completedMilestones, badges, avgCompletion] =
    await Promise.all([
      Goal.countDocuments({ user: id, isDeleted: false }),
      Goal.countDocuments({ user: id, isDeleted: false, status: GOAL_STATUS.COMPLETED }),
      Goal.countDocuments({ user: id, isDeleted: false, status: GOAL_STATUS.ACTIVE }),
      VisionBoard.countDocuments({ user: id, isDeleted: false }),
      Milestone.countDocuments({ user: id, isDeleted: false }),
      Milestone.countDocuments({ user: id, isDeleted: false, isCompleted: true }),
      UserBadge.countDocuments({ user: id }),
      overallProgress(userId)
    ]);

  return {
    goals,
    activeGoals,
    completedGoals,
    boards,
    totalMilestones,
    completedMilestones,
    milestonePercent: percentage(completedMilestones, totalMilestones),
    badges,
    avgCompletion
  };
};

export const weeklyDelta = async ({ userId, timezone, totalMilestones }) => {
  const todayKey = dayKey(new Date(), timezone);
  const sevenDaysAgoKey = shiftDayKey(todayKey, -7);

  const snapshot = await ProgressSnapshot.findOne({ user: toObjectId(userId), dayKey: sevenDaysAgoKey });

  if (snapshot) {
    const current = await overallProgress(userId);
    return { delta: current - snapshot.overallPercent, deltaBasis: 'snapshot' };
  }

  const recentCompletions = await Milestone.countDocuments({
    user: toObjectId(userId),
    isDeleted: false,
    isCompleted: true,
    completedAt: { $gte: addDays(new Date(), -7) }
  });

  return {
    delta: percentage(recentCompletions, Math.max(totalMilestones, 1)),
    deltaBasis: 'activity'
  };
};

export const completionSeries = async ({ userId, range = CHART_RANGE.DAILY, timezone = 'UTC' }) => {
  const tz = safeTimezone(timezone);
  const id = toObjectId(userId);
  const todayKey = dayKey(new Date(), tz);

  if (range === CHART_RANGE.MONTHLY) {
    const buckets = buildMonthlyBuckets(todayKey, { months: 12 });
    const start = dayKeyToUtcDate(`${buckets[0].key}-01`);

    const rows = await Milestone.aggregate([
      {
        $match: {
          user: id,
          isDeleted: false,
          isCompleted: true,
          completedAt: { $gte: start }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$completedAt', timezone: tz } },
          count: { $sum: 1 }
        }
      }
    ]);

    return zeroFill(buckets, rows);
  }

  if (range === CHART_RANGE.WEEKLY) {
    const buckets = buildWeeklyBuckets(todayKey, { weeks: 8, startOfWeek: 'monday' });
    const start = dayKeyToUtcDate(buckets[0].key);

    const rows = await Milestone.aggregate([
      {
        $match: {
          user: id,
          isDeleted: false,
          isCompleted: true,
          completedAt: { $gte: start }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateTrunc: { date: '$completedAt', unit: 'week', startOfWeek: 'monday', timezone: tz }
              },
              timezone: tz
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    return zeroFill(buckets, rows);
  }

  const buckets = buildDailyBuckets(todayKey, { days: 7, startOfWeek: 'monday', alignToWeek: true });
  const start = dayKeyToUtcDate(buckets[0].key);
  const end = addDays(dayKeyToUtcDate(buckets[buckets.length - 1].key), 1);

  const rows = await Milestone.aggregate([
    {
      $match: {
        user: id,
        isDeleted: false,
        isCompleted: true,
        completedAt: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: tz } },
        count: { $sum: 1 }
      }
    }
  ]);

  return zeroFill(buckets, rows);
};

export const dashboardStats = async () => {
  const now = new Date();
  const currentWindowStart = addDays(now, -ACTIVE_USER_WINDOW_DAYS);
  const previousWindowStart = addDays(now, -ACTIVE_USER_WINDOW_DAYS * 2);

  const baseFilter = { isDeleted: false, role: ROLES.USER };

  const [totalUsers, activeUsers, newThisWindow, newPreviousWindow, activePreviousWindow] = await Promise.all([
    User.countDocuments(baseFilter),
    User.countDocuments({ ...baseFilter, status: USER_STATUS.ACTIVE, lastActiveAt: { $gte: currentWindowStart } }),
    User.countDocuments({ ...baseFilter, createdAt: { $gte: currentWindowStart } }),
    User.countDocuments({ ...baseFilter, createdAt: { $gte: previousWindowStart, $lt: currentWindowStart } }),
    User.countDocuments({
      ...baseFilter,
      lastActiveAt: { $gte: previousWindowStart, $lt: currentWindowStart }
    })
  ]);

  const totalChange = changePercent(newThisWindow, newPreviousWindow);
  const activeChange = changePercent(activeUsers, activePreviousWindow);

  return {
    totalUsers: {
      value: totalUsers,
      percent: Math.min(percentage(totalUsers, env.ADMIN_USER_TARGET), 100),
      changePercent: totalChange,
      trend: totalChange > 0 ? 'up' : totalChange < 0 ? 'down' : 'flat'
    },
    activeUsers: {
      value: activeUsers,
      percent: percentage(activeUsers, totalUsers),
      changePercent: activeChange,
      trend: activeChange > 0 ? 'up' : activeChange < 0 ? 'down' : 'flat'
    }
  };
};

export const registrationRate = async ({ week = 'current', start } = {}) => {
  const tz = safeTimezone(env.ADMIN_TIMEZONE);
  const todayKey = dayKey(new Date(), tz);
  const anchorKey = start || (week === 'previous' ? shiftDayKey(todayKey, -7) : todayKey);
  const { startKey, start: rangeStart, end: rangeEnd } = weekRangeFromDayKey(anchorKey, 'sunday');

  const buckets = buildDailyBuckets(startOfWeekDayKey(startKey, 'sunday'), {
    days: 7,
    startOfWeek: 'sunday',
    alignToWeek: true
  });

  const rows = await User.aggregate([
    {
      $match: {
        isDeleted: false,
        role: ROLES.USER,
        createdAt: { $gte: rangeStart, $lte: rangeEnd }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
        count: { $sum: 1 }
      }
    }
  ]);

  const filled = zeroFill(buckets, rows);
  const total = filled.reduce((sum, bucket) => sum + bucket.count, 0);

  return {
    weekStart: startKey,
    total,
    series: filled.map((bucket) => ({ ...bucket, percent: percentage(bucket.count, total) }))
  };
};

export const userGrowth = async (year) => {
  const tz = safeTimezone(env.ADMIN_TIMEZONE);
  const targetYear = Number(year) || new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(targetYear, 0, 1));
  const yearEnd = new Date(Date.UTC(targetYear + 1, 0, 1));

  const [rows, carryIn] = await Promise.all([
    User.aggregate([
      {
        $match: {
          isDeleted: false,
          role: ROLES.USER,
          createdAt: { $gte: yearStart, $lt: yearEnd }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: tz } },
          count: { $sum: 1 }
        }
      }
    ]),
    User.countDocuments({ isDeleted: false, role: ROLES.USER, createdAt: { $lt: yearStart } })
  ]);

  const filled = zeroFill(buildYearMonthBuckets(targetYear), rows);
  let running = carryIn;

  return {
    year: targetYear,
    carryIn,
    series: filled.map((bucket) => {
      running += bucket.count;
      return { month: bucket.label, key: bucket.key, newUsers: bucket.count, totalUsers: running };
    })
  };
};

export { percentage, changePercent, toObjectId };
