import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import { CHART_RANGE, CHART_RANGE_VALUES } from '../constants/index.js';
import { completionSeries, userStats, weeklyDelta } from '../services/analytics.service.js';
import { readStreak } from '../services/streak.service.js';

const resolveRange = (value) =>
  CHART_RANGE_VALUES.includes(value) ? value : CHART_RANGE.DAILY;

export const getProgress = catchAsync(async (req, res) => {
  const range = resolveRange(req.query.range);
  const { _id: userId, timezone } = req.user;

  const stats = await userStats(userId);

  const [chart, delta] = await Promise.all([
    completionSeries({ userId, range, timezone }),
    weeklyDelta({ userId, timezone, totalMilestones: stats.totalMilestones })
  ]);

  const streak = readStreak(req.user);

  sendResponse(res, {
    message: 'Progress retrieved successfully',
    data: {
      overall: {
        percent: stats.avgCompletion,
        delta: delta.delta,
        deltaBasis: delta.deltaBasis,
        deltaLabel: `${delta.delta >= 0 ? '+' : ''}${delta.delta}% this week`
      },
      completedGoals: stats.completedGoals,
      milestones: {
        completed: stats.completedMilestones,
        total: stats.totalMilestones,
        percent: stats.milestonePercent,
        label: `${stats.completedMilestones}/${stats.totalMilestones}`
      },
      streak: {
        ...streak,
        label: streak.isPersonalBest ? 'Personal best' : 'Keep going!'
      },
      chart: { range, series: chart }
    }
  });
});

export const getChart = catchAsync(async (req, res) => {
  const range = resolveRange(req.query.range);

  const series = await completionSeries({
    userId: req.user._id,
    range,
    timezone: req.user.timezone
  });

  sendResponse(res, {
    message: 'Completion chart retrieved successfully',
    data: { range, series }
  });
});

export const getStreak = catchAsync(async (req, res) => {
  const streak = readStreak(req.user);

  sendResponse(res, {
    message: 'Streak retrieved successfully',
    data: { ...streak, label: streak.isPersonalBest ? 'Personal best' : 'Keep going!' }
  });
});
