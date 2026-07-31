import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import Dream from '../models/dream.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import { LIMIT_LABELS, PLAN_LIMITS, SUBSCRIPTION_TIER, UNLIMITED } from '../constants/index.js';

export const limitsFor = (tier) => PLAN_LIMITS[tier] || PLAN_LIMITS[SUBSCRIPTION_TIER.FREE];

export const isUnlimited = (value) => value === UNLIMITED;

const COUNTERS = {
  boards: ({ user }) => VisionBoard.countDocuments({ user: user._id, isDeleted: false }),
  goals: ({ user }) => Goal.countDocuments({ user: user._id, isDeleted: false }),
  dreamsPerBoard: ({ scopeId }) => Dream.countDocuments({ board: scopeId, isDeleted: false }),
  milestonesPerGoal: ({ scopeId }) => Milestone.countDocuments({ goal: scopeId, isDeleted: false }),
  customAreasOfLife: ({ user }) => AreaOfLife.countDocuments({ user: user._id })
};

export const currentUsage = async (resource, { user, scopeId }) => {
  const counter = COUNTERS[resource];
  if (!counter) return 0;

  return counter({ user, scopeId });
};

export const assertWithinLimit = async (resource, { user, scopeId }) => {
  const limit = limitsFor(user.activeTier)[resource];

  if (limit === undefined || isUnlimited(limit)) return;

  const used = await currentUsage(resource, { user, scopeId });

  if (used >= limit) {
    const label = LIMIT_LABELS[resource] || resource;

    throw new ApiError(
      StatusCodes.FORBIDDEN,
      `Your free plan allows up to ${limit} ${label}${limit === 1 ? '' : 's'}. Upgrade to Premium for unlimited access`
    );
  }
};

export const planSnapshot = async (user) => {
  const tier = user.activeTier;
  const limits = limitsFor(tier);

  const [boards, goals, customAreasOfLife] = await Promise.all([
    currentUsage('boards', { user }),
    currentUsage('goals', { user }),
    currentUsage('customAreasOfLife', { user })
  ]);

  const describe = (used, limit) => ({
    used,
    limit: isUnlimited(limit) ? null : limit,
    unlimited: isUnlimited(limit),
    remaining: isUnlimited(limit) ? null : Math.max(limit - used, 0)
  });

  return {
    tier,
    storedTier: user.subscription?.tier || SUBSCRIPTION_TIER.FREE,
    source: user.subscription?.source || 'none',
    startedAt: user.subscription?.startedAt || null,
    expiresAt: user.subscription?.expiresAt || null,
    isPremium: tier === SUBSCRIPTION_TIER.PREMIUM,
    limits,
    usage: {
      boards: describe(boards, limits.boards),
      goals: describe(goals, limits.goals),
      customAreasOfLife: describe(customAreasOfLife, limits.customAreasOfLife),
      dreamsPerBoard: { limit: isUnlimited(limits.dreamsPerBoard) ? null : limits.dreamsPerBoard, unlimited: isUnlimited(limits.dreamsPerBoard) },
      milestonesPerGoal: {
        limit: isUnlimited(limits.milestonesPerGoal) ? null : limits.milestonesPerGoal,
        unlimited: isUnlimited(limits.milestonesPerGoal)
      }
    }
  };
};
