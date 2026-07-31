import mongoose from 'mongoose';
import Badge from '../models/badge.model.js';
import UserBadge from '../models/userBadge.model.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import Dream from '../models/dream.model.js';
import User from '../models/user.model.js';
import { BADGE_METRIC, GOAL_STATUS, NOTIFICATION_TYPE } from '../constants/index.js';
import { createNotification } from './notification.service.js';
import { readStreak } from './streak.service.js';

const collectMetrics = async (userId) => {
  const id = new mongoose.Types.ObjectId(String(userId));

  const [user, goalsCreated, goalsCompleted, milestonesCompleted, boardsCreated, dreamsCreated, areas] =
    await Promise.all([
      User.findById(id).select('streak timezone'),
      Goal.countDocuments({ user: id, isDeleted: false }),
      Goal.countDocuments({ user: id, isDeleted: false, status: GOAL_STATUS.COMPLETED }),
      Milestone.countDocuments({ user: id, isDeleted: false, isCompleted: true }),
      VisionBoard.countDocuments({ user: id, isDeleted: false }),
      Dream.countDocuments({ user: id, isDeleted: false }),
      Goal.distinct('areaOfLife', { user: id, isDeleted: false })
    ]);

  const streak = user ? readStreak(user) : { current: 0 };

  return {
    [BADGE_METRIC.GOALS_CREATED]: goalsCreated,
    [BADGE_METRIC.GOALS_COMPLETED]: goalsCompleted,
    [BADGE_METRIC.MILESTONES_COMPLETED]: milestonesCompleted,
    [BADGE_METRIC.BOARDS_CREATED]: boardsCreated,
    [BADGE_METRIC.DREAMS_CREATED]: dreamsCreated,
    [BADGE_METRIC.STREAK_CURRENT]: streak.current,
    [BADGE_METRIC.AREAS_COVERED]: areas.length
  };
};

export const evaluateBadges = async (userId) => {
  const [badges, metrics, existing] = await Promise.all([
    Badge.find({ isActive: true }),
    collectMetrics(userId),
    UserBadge.find({ user: userId }).select('badge')
  ]);

  const alreadyEarned = new Set(existing.map((row) => row.badge.toString()));

  const newlyQualified = badges.filter(
    (badge) =>
      !alreadyEarned.has(badge._id.toString()) &&
      (metrics[badge.criteria.metric] ?? 0) >= badge.criteria.threshold
  );

  if (newlyQualified.length === 0) return [];

  await UserBadge.bulkWrite(
    newlyQualified.map((badge) => ({
      updateOne: {
        filter: { user: userId, badge: badge._id },
        update: { $setOnInsert: { user: userId, badge: badge._id, earnedAt: new Date() } },
        upsert: true
      }
    }))
  );

  await Promise.all(
    newlyQualified.map((badge) =>
      createNotification({
        user: userId,
        title: 'New achievement unlocked',
        body: `${badge.name} - ${badge.description}`,
        type: NOTIFICATION_TYPE.BADGE_EARNED,
        data: { badgeId: badge._id.toString(), code: badge.code },
        dedupeKey: `badge_earned:${userId}:${badge.code}`
      })
    )
  );

  return newlyQualified;
};

export const listWithProgress = async (userId) => {
  const [badges, metrics, earned] = await Promise.all([
    Badge.find({ isActive: true }).sort({ order: 1 }),
    collectMetrics(userId),
    UserBadge.find({ user: userId })
  ]);

  const earnedMap = new Map(earned.map((row) => [row.badge.toString(), row.earnedAt]));

  return badges.map((badge) => {
    const current = metrics[badge.criteria.metric] ?? 0;
    const threshold = badge.criteria.threshold;
    const earnedAt = earnedMap.get(badge._id.toString()) || null;

    return {
      _id: badge._id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      order: badge.order,
      criteria: badge.criteria,
      earned: Boolean(earnedAt),
      earnedAt,
      progress: {
        current: Math.min(current, threshold),
        threshold,
        percent: Math.min(Math.round((current / threshold) * 100), 100)
      }
    };
  });
};

export { collectMetrics };
