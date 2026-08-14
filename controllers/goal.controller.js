import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import Priority from '../models/priority.model.js';
import Dream from '../models/dream.model.js';
import { ACTIVITY_TYPE, GOAL_STATUS } from '../constants/index.js';
import { logActivity, removeActivity } from '../services/activity.service.js';
import { recomputeGoalProgress } from '../services/goalProgress.service.js';
import { recomputeDreamProgress } from '../services/dreamProgress.service.js';
import { evaluateBadges } from '../services/badge.service.js';
import { assertWithinLimit } from '../services/plan.service.js';
import { formatDateLabel, relativeDueLabel } from '../utils/labelHelper.js';

const POPULATE_AREA = { path: 'areaOfLife', select: 'name slug color icon' };
const POPULATE_PRIORITY = { path: 'priority', select: 'name slug color weight' };
const POPULATE_DREAM = { path: 'dream', select: 'title images progress board' };

export const decorateGoal = (goal, timezone) => {
  const plain = typeof goal.toObject === 'function' ? goal.toObject() : goal;

  return {
    ...plain,
    targetDateLabel: formatDateLabel(plain.targetDate, timezone),
    dueLabel: relativeDueLabel(plain.targetDate, timezone),
    completedAtLabel: formatDateLabel(plain.completedAt, timezone),
    milestoneSummary: `${plain.completedMilestones}/${plain.totalMilestones} milestones`
  };
};

export const decorateMilestone = (milestone, timezone) => {
  const plain = typeof milestone.toObject === 'function' ? milestone.toObject() : milestone;

  return {
    ...plain,
    dueDateLabel: formatDateLabel(plain.dueDate, timezone),
    dueLabel: plain.isCompleted ? 'Completed' : relativeDueLabel(plain.dueDate, timezone)
  };
};

const findOwnedGoal = async (goalId, userId) => {
  const goal = await Goal.findOne({ _id: goalId, user: userId, isDeleted: false });

  if (!goal) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Goal not found');
  }

  return goal;
};

const assertReferences = async ({ areaOfLife, priority, dream }, userId) => {
  if (areaOfLife) {
    const exists = await AreaOfLife.exists({
      _id: areaOfLife,
      isActive: true,
      $or: [{ user: null }, { user: userId }]
    });
    if (!exists) throw new ApiError(StatusCodes.BAD_REQUEST, 'Selected area of life is not available');
  }

  if (priority) {
    const exists = await Priority.exists({ _id: priority, isActive: true });
    if (!exists) throw new ApiError(StatusCodes.BAD_REQUEST, 'Selected priority is not available');
  }

  if (dream) {
    const exists = await Dream.exists({ _id: dream, user: userId, isDeleted: false });
    if (!exists) throw new ApiError(StatusCodes.BAD_REQUEST, 'Selected dream could not be found');
  }
};

export const listGoals = catchAsync(async (req, res) => {
  const { timezone } = req.user;
  const query = { ...req.query };

  if (!query.status || query.status === 'all') {
    delete query.status;
  }

  const builder = new QueryBuilder(
    Goal.find({ user: req.user._id, isDeleted: false })
      .populate(POPULATE_AREA)
      .populate(POPULATE_PRIORITY)
      .populate(POPULATE_DREAM),
    query
  )
    .search(['title', 'description'])
    .filter()
    .sort('-createdAt')
    .paginate();

  const [goals, meta, activeCount] = await Promise.all([
    builder.modelQuery,
    builder.countTotal(),
    Goal.countDocuments({ user: req.user._id, isDeleted: false, status: GOAL_STATUS.ACTIVE })
  ]);

  sendResponse(res, {
    message: 'Goals retrieved successfully',
    meta,
    data: {
      summary: {
        activeCount,
        headline: `${activeCount} dream${activeCount === 1 ? '' : 's'} in motion`
      },
      goals: goals.map((goal) => decorateGoal(goal, timezone))
    }
  });
});

export const createGoal = catchAsync(async (req, res) => {
  await assertWithinLimit('goals', { user: req.user });

  const payload = pick(req.body, ['title', 'description', 'dream', 'areaOfLife', 'priority', 'targetDate']);

  await assertReferences(payload, req.user._id);

  const goal = await Goal.create({ ...payload, user: req.user._id });
  await goal.populate([POPULATE_AREA, POPULATE_PRIORITY, POPULATE_DREAM]);

  if (goal.dream) {
    await recomputeDreamProgress(goal.dream);
  }

  await logActivity({
    user: req.user,
    type: ACTIVITY_TYPE.GOAL_CREATED,
    refId: goal._id,
    refModel: 'Goal'
  });

  await evaluateBadges(req.user._id);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Goal created successfully',
    data: decorateGoal(goal, req.user.timezone)
  });
});

export const getGoal = catchAsync(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false })
    .populate(POPULATE_AREA)
    .populate(POPULATE_PRIORITY)
    .populate(POPULATE_DREAM);

  if (!goal) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Goal not found');
  }

  const milestones = await Milestone.find({ goal: goal._id, isDeleted: false }).sort({
    order: 1,
    dueDate: 1
  });

  sendResponse(res, {
    message: 'Goal retrieved successfully',
    data: {
      ...decorateGoal(goal, req.user.timezone),
      milestoneProgressLabel: `${goal.completedMilestones} of ${goal.totalMilestones} milestones complete`,
      milestones: milestones.map((milestone) => decorateMilestone(milestone, req.user.timezone))
    }
  });
});

export const updateGoal = catchAsync(async (req, res) => {
  const goal = await findOwnedGoal(req.params.id, req.user._id);
  const payload = pick(req.body, ['title', 'description', 'dream', 'areaOfLife', 'priority', 'targetDate']);
  const previousDream = goal.dream;

  await assertReferences(payload, req.user._id);

  if (Object.prototype.hasOwnProperty.call(req.body, 'dream')) {
    payload.dream = req.body.dream || null;
  }

  Object.assign(goal, payload);
  await goal.save();
  await goal.populate([POPULATE_AREA, POPULATE_PRIORITY, POPULATE_DREAM]);

  if (previousDream && String(previousDream) !== String(goal.dream || '')) {
    await recomputeDreamProgress(previousDream);
  }

  if (goal.dream) {
    await recomputeDreamProgress(goal.dream);
  }

  sendResponse(res, {
    message: 'Goal updated successfully',
    data: decorateGoal(goal, req.user.timezone)
  });
});

export const deleteGoal = catchAsync(async (req, res) => {
  const goal = await findOwnedGoal(req.params.id, req.user._id);

  goal.isDeleted = true;
  await goal.save();

  if (goal.dream) {
    await recomputeDreamProgress(goal.dream);
  }

  await Milestone.updateMany({ goal: goal._id }, { isDeleted: true });
  await removeActivity({ user: req.user, type: ACTIVITY_TYPE.GOAL_COMPLETED, refId: goal._id });
  await removeActivity({ user: req.user, type: ACTIVITY_TYPE.GOAL_CREATED, refId: goal._id });

  sendResponse(res, { message: 'Goal deleted successfully' });
});

export const setGoalCompletion = catchAsync(async (req, res) => {
  const goal = await findOwnedGoal(req.params.id, req.user._id);
  const { isCompleted } = req.body;

  if (isCompleted) {
    if (goal.totalMilestones > 0 && goal.completedMilestones < goal.totalMilestones) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Complete every milestone before marking this goal as done'
      );
    }
    goal.isManuallyCompleted = true;
  } else {
    goal.isManuallyCompleted = false;
    goal.status = GOAL_STATUS.ACTIVE;
    goal.completedAt = null;
  }

  await goal.save();

  const updated = await recomputeGoalProgress(goal._id);
  await updated.populate([POPULATE_AREA, POPULATE_PRIORITY]);

  sendResponse(res, {
    message: isCompleted ? 'Goal marked as completed' : 'Goal reopened',
    data: decorateGoal(updated, req.user.timezone)
  });
});

export const setGoalArchive = catchAsync(async (req, res) => {
  const goal = await findOwnedGoal(req.params.id, req.user._id);

  if (req.body.isArchived) {
    goal.status = GOAL_STATUS.ARCHIVED;
    await goal.save();
  } else {
    goal.status = GOAL_STATUS.ACTIVE;
    await goal.save();
    await recomputeGoalProgress(goal._id);
  }

  const updated = await Goal.findById(goal._id).populate(POPULATE_AREA).populate(POPULATE_PRIORITY);

  sendResponse(res, {
    message: req.body.isArchived ? 'Goal archived successfully' : 'Goal restored successfully',
    data: decorateGoal(updated, req.user.timezone)
  });
});

export const listGoalMilestones = catchAsync(async (req, res) => {
  await findOwnedGoal(req.params.id, req.user._id);

  const filter = { goal: req.params.id, isDeleted: false };

  if (req.query.status === 'pending') filter.isCompleted = false;
  if (req.query.status === 'completed') filter.isCompleted = true;

  const milestones = await Milestone.find(filter).sort({ order: 1, dueDate: 1 });

  sendResponse(res, {
    message: 'Milestones retrieved successfully',
    data: milestones.map((milestone) => decorateMilestone(milestone, req.user.timezone))
  });
});

export const createGoalMilestone = catchAsync(async (req, res) => {
  const goal = await findOwnedGoal(req.params.id, req.user._id);

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
