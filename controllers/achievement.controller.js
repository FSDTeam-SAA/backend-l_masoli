import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import { listWithProgress } from '../services/badge.service.js';
import { overallProgress } from '../services/analytics.service.js';

const buildSummary = (badges, avgCompletion) => {
  const earnedCount = badges.filter((badge) => badge.earned).length;

  return {
    earnedCount,
    totalCount: badges.length,
    avgCompletion,
    label: `${earnedCount} badge${earnedCount === 1 ? '' : 's'} - ${avgCompletion}% avg completion`
  };
};

export const getAchievements = catchAsync(async (req, res) => {
  const [badges, avgCompletion] = await Promise.all([
    listWithProgress(req.user._id),
    overallProgress(req.user._id)
  ]);

  sendResponse(res, {
    message: 'Achievements retrieved successfully',
    data: {
      summary: buildSummary(badges, avgCompletion),
      earned: badges.filter((badge) => badge.earned),
      locked: badges.filter((badge) => !badge.earned)
    }
  });
});

export const getAchievementSummary = catchAsync(async (req, res) => {
  const [badges, avgCompletion] = await Promise.all([
    listWithProgress(req.user._id),
    overallProgress(req.user._id)
  ]);

  sendResponse(res, {
    message: 'Achievement summary retrieved successfully',
    data: buildSummary(badges, avgCompletion)
  });
});
