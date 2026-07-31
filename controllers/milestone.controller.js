import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import { ACTIVITY_TYPE } from '../constants/index.js';
import { logActivity, removeActivity } from '../services/activity.service.js';
import { recomputeGoalProgress } from '../services/goalProgress.service.js';
import { touchStreak, readStreak } from '../services/streak.service.js';
import { evaluateBadges } from '../services/badge.service.js';
import { assertWithinLimit } from '../services/plan.service.js';
import { decorateGoal, decorateMilestone } from './goal.controller.js';
import { addDays } from '../utils/dateHelper.js';

const findOwnedMilestone = async (milestoneId, userId) => {
  const milestone = await Milestone.findOne({ _id: milestoneId, user: userId, isDeleted: false });

  if (!milestone) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Milestone not found');
  }

  return milestone;
};

export const createMilestone = catchAsync(async (req, res) => {
  if (!req.body.goal) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'goal is required');
  }

  const goal = await Goal.findOne({ _id: req.body.goal, user: req.user._id, isDeleted: false });

  if (!goal) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Goal not found');
  }

  await assertWithinLimit('milestonesPerGoal', { user: req.user, scopeId: goal._id });

  const milestone = await Milestone.create({
    user: req.user._id,
    goal: goal._id,
    title: req.body.title,
    dueDate: req.body.dueDate,
    order: req.body.order ?? goal.totalMilestones
  });

  const updatedGoal = await recomputeGoalProgress(goal._id);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Milestone added successfully',
    data: {
      milestone: decorateMilestone(milestone, req.user.timezone),
      goal: decorateGoal(updatedGoal, req.user.timezone)
    }
  });
});

export const getUpcomingMilestones = catchAsync(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const withinDays = Number(req.query.withinDays) || 0;

  const filter = { user: req.user._id, isDeleted: false, isCompleted: false };

  if (withinDays > 0) {
    filter.dueDate = { $lte: addDays(new Date(), withinDays) };
  }

  const milestones = await Milestone.find(filter)
    .sort({ dueDate: 1 })
    .limit(limit)
    .populate({ path: 'goal', select: 'title' });

  sendResponse(res, {
    message: 'Upcoming milestones retrieved successfully',
    data: milestones.map((milestone) => ({
      ...decorateMilestone(milestone, req.user.timezone),
      goalId: milestone.goal?._id,
      goalTitle: milestone.goal?.title || ''
    }))
  });
});

export const getMilestone = catchAsync(async (req, res) => {
  const milestone = await findOwnedMilestone(req.params.id, req.user._id);
  await milestone.populate({ path: 'goal', select: 'title progress' });

  sendResponse(res, {
    message: 'Milestone retrieved successfully',
    data: decorateMilestone(milestone, req.user.timezone)
  });
});

export const updateMilestone = catchAsync(async (req, res) => {
  const milestone = await findOwnedMilestone(req.params.id, req.user._id);

  Object.assign(milestone, pick(req.body, ['title', 'dueDate', 'order']));
  await milestone.save();

  sendResponse(res, {
    message: 'Milestone updated successfully',
    data: decorateMilestone(milestone, req.user.timezone)
  });
});

export const toggleMilestone = catchAsync(async (req, res) => {
  const milestone = await findOwnedMilestone(req.params.id, req.user._id);

  const nextState = !milestone.isCompleted;
  milestone.isCompleted = nextState;
  milestone.completedAt = nextState ? new Date() : null;
  await milestone.save();

  const goal = await recomputeGoalProgress(milestone.goal);

  let streak;

  if (nextState) {
    await logActivity({
      user: req.user,
      type: ACTIVITY_TYPE.MILESTONE_COMPLETED,
      refId: milestone._id,
      refModel: 'Milestone'
    });

    streak = await touchStreak(req.user);
    await evaluateBadges(req.user._id);
  } else {
    await removeActivity({
      user: req.user,
      type: ACTIVITY_TYPE.MILESTONE_COMPLETED,
      refId: milestone._id
    });

    streak = readStreak(req.user);
  }

  sendResponse(res, {
    message: nextState ? 'Milestone completed' : 'Milestone reopened',
    data: {
      milestone: decorateMilestone(milestone, req.user.timezone),
      goal: goal ? decorateGoal(goal, req.user.timezone) : null,
      streak
    }
  });
});

export const deleteMilestone = catchAsync(async (req, res) => {
  const milestone = await findOwnedMilestone(req.params.id, req.user._id);

  milestone.isDeleted = true;
  await milestone.save();

  await removeActivity({
    user: req.user,
    type: ACTIVITY_TYPE.MILESTONE_COMPLETED,
    refId: milestone._id
  });

  const goal = await recomputeGoalProgress(milestone.goal);

  sendResponse(res, {
    message: 'Milestone deleted successfully',
    data: { goal: goal ? decorateGoal(goal, req.user.timezone) : null }
  });
});

export const reorderMilestones = catchAsync(async (req, res) => {
  const ids = req.body.items.map((item) => item.id);

  const owned = await Milestone.countDocuments({
    _id: { $in: ids },
    user: req.user._id,
    isDeleted: false
  });

  if (owned !== ids.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more milestones could not be found');
  }

  await Milestone.bulkWrite(
    req.body.items.map((item) => ({
      updateOne: { filter: { _id: item.id, user: req.user._id }, update: { order: item.order } }
    }))
  );

  sendResponse(res, { message: 'Milestones reordered successfully' });
});
