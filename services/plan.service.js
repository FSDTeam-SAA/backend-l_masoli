import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import Dream from '../models/dream.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import env from '../config/env.js';
import {
  PLAN_LIMITS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TIER,
  UNLIMITED
} from '../constants/index.js';

export const limitsFor = (tier) => PLAN_LIMITS[tier] || PLAN_LIMITS[SUBSCRIPTION_TIER.FREE];

export const isUnlimited = (value) => value === UNLIMITED;

const COUNTERS = {
  boards: ({ user }) => VisionBoard.countDocuments({ user: user._id, isDeleted: false }),
  goals: ({ user }) => Goal.countDocuments({ user: user._id, isDeleted: false }),
  goalsPerArea: ({ user, scopeId }) =>
    Goal.countDocuments({ user: user._id, areaOfLife: scopeId, isDeleted: false }),
  dreamsPerBoard: ({ scopeId }) => Dream.countDocuments({ board: scopeId, isDeleted: false }),
  milestonesPerGoal: ({ scopeId }) => Milestone.countDocuments({ goal: scopeId, isDeleted: false }),
  customAreasOfLife: ({ user }) => AreaOfLife.countDocuments({ user: user._id })
};

export const currentUsage = async (resource, { user, scopeId }) => {
  const counter = COUNTERS[resource];
  if (!counter) return 0;

  return counter({ user, scopeId });
};

// Copy only: resource keys, ceilings, counters and enforcement stay unchanged.
const trialLimitMessage = (resource, limit) => {
  const labels = {
    boards: ['Dream Board', 'Dream Boards', ''],
    customAreasOfLife: ['custom Area of Life', 'custom Areas of Life', ''],
    goalsPerArea: ['Goal', 'Goals', ' for this Area of Life'],
    milestonesPerGoal: ['Milestone', 'Milestones', ' for this Goal'],
    dreamsPerBoard: ['Dream', 'Dreams', ' for this Dream Board'],
    goals: ['Goal', 'Goals', '']
  }[resource];
  if (!labels || !Number.isFinite(limit)) {
    return "You've reached your free trial limit. Upgrade to Premium for unlimited access.";
  }
  const [singular, plural, scope] = labels;
  return `You've reached your free trial limit of ${limit} ${limit === 1 ? singular : plural}${scope}. Upgrade to Premium to create unlimited ${plural}.`;
};

export const assertWithinLimit = async (resource, { user, scopeId }) => {
  const limit = limitsFor(user.activeTier)[resource];

  if (limit === undefined || isUnlimited(limit)) return;

  const used = await currentUsage(resource, { user, scopeId });

  if (used >= limit) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      trialLimitMessage(resource, limit)
    );
  }
};

export const planSnapshot = async (user) => {
  const tier = user.activeTier;
  const limits = limitsFor(tier);
  const status =
    typeof user.resolvedSubscriptionStatus === 'function'
      ? user.resolvedSubscriptionStatus()
      : user.subscription?.status ||
        (user.subscription?.tier === SUBSCRIPTION_TIER.PREMIUM
          ? SUBSCRIPTION_STATUS.ACTIVE
          : SUBSCRIPTION_STATUS.NONE);
  const accessLevel = user.accessLevel;
  let lockReason;
  if (accessLevel === 'locked') {
    if (status === SUBSCRIPTION_STATUS.NONE) {
      lockReason = 'never_started';
    } else if (
      status === SUBSCRIPTION_STATUS.TRIALING &&
      user.subscription?.trialEndsAt &&
      new Date(user.subscription.trialEndsAt).getTime() <= Date.now()
    ) {
      lockReason = 'trial_ended';
    } else {
      // Includes explicit expired status and legacy active paid periods whose
      // expiresAt has elapsed. Ambiguous locked states keep neutral copy.
      lockReason = 'subscription_ended';
    }
  }

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
    accessLevel,
    ...(lockReason && { lockReason }),
    tier,
    storedTier: user.subscription?.tier || SUBSCRIPTION_TIER.FREE,
    status,
    billingPeriod: user.subscription?.billingPeriod || null,
    source: user.subscription?.source || 'none',
    startedAt: user.subscription?.startedAt || null,
    trialEndsAt: user.subscription?.trialEndsAt || null,
    expiresAt: user.subscription?.expiresAt || null,
    autoRenew: user.subscription?.autoRenew ?? false,
    store: user.subscription?.store || null,
    isSandbox: user.subscription?.isSandbox ?? false,
    billingIssue: user.subscription?.billingIssue ?? false,
    testMode: env.BILLING_TEST_MODE,
    isPremium: tier === SUBSCRIPTION_TIER.PREMIUM,
    limits,
    usage: {
      boards: describe(boards, limits.boards),
      goals: describe(goals, limits.goals),
      customAreasOfLife: describe(customAreasOfLife, limits.customAreasOfLife),
      dreamsPerBoard: { limit: isUnlimited(limits.dreamsPerBoard) ? null : limits.dreamsPerBoard, unlimited: isUnlimited(limits.dreamsPerBoard) },
      goalsPerArea: {
        limit: isUnlimited(limits.goalsPerArea) ? null : limits.goalsPerArea,
        unlimited: isUnlimited(limits.goalsPerArea)
      },
      milestonesPerGoal: {
        limit: isUnlimited(limits.milestonesPerGoal) ? null : limits.milestonesPerGoal,
        unlimited: isUnlimited(limits.milestonesPerGoal)
      }
    }
  };
};
