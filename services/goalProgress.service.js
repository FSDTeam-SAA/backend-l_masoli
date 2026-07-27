import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import User from '../models/user.model.js';
import { ACTIVITY_TYPE, GOAL_STATUS, NOTIFICATION_TYPE } from '../constants/index.js';
import { logActivity, removeActivity } from './activity.service.js';
import { createNotification } from './notification.service.js';
import { evaluateBadges } from './badge.service.js';

export const recomputeGoalProgress = async (goalId, { silent = false } = {}) => {
  const goal = await Goal.findById(goalId);

  if (!goal || goal.isDeleted) return null;

  const [totalMilestones, completedMilestones] = await Promise.all([
    Milestone.countDocuments({ goal: goal._id, isDeleted: false }),
    Milestone.countDocuments({ goal: goal._id, isDeleted: false, isCompleted: true })
  ]);

  const hasMilestones = totalMilestones > 0;
  const allDone = hasMilestones && completedMilestones === totalMilestones;
  const shouldComplete = allDone || (!hasMilestones && goal.isManuallyCompleted);

  let progress;
  if (hasMilestones) {
    progress = Math.round((completedMilestones / totalMilestones) * 100);
  } else {
    progress = goal.isManuallyCompleted ? 100 : 0;
  }

  const wasCompleted = goal.status === GOAL_STATUS.COMPLETED;
  const isArchived = goal.status === GOAL_STATUS.ARCHIVED;

  let status = goal.status;
  if (!isArchived) {
    status = shouldComplete ? GOAL_STATUS.COMPLETED : GOAL_STATUS.ACTIVE;
  }

  const becameCompleted = !wasCompleted && status === GOAL_STATUS.COMPLETED;
  const becameIncomplete = wasCompleted && status !== GOAL_STATUS.COMPLETED;

  goal.totalMilestones = totalMilestones;
  goal.completedMilestones = completedMilestones;
  goal.progress = progress;
  goal.status = status;

  if (becameCompleted) {
    goal.completedAt = goal.completedAt || new Date();
  } else if (becameIncomplete) {
    goal.completedAt = null;
    goal.isManuallyCompleted = false;
  }

  await goal.save();

  if (silent) return goal;

  if (becameCompleted) {
    const user = await User.findById(goal.user);

    await logActivity({
      user,
      type: ACTIVITY_TYPE.GOAL_COMPLETED,
      refId: goal._id,
      refModel: 'Goal'
    });

    await createNotification({
      user: goal.user,
      title: 'Goal completed',
      body: `You completed "${goal.title}". Time to dream bigger.`,
      type: NOTIFICATION_TYPE.GOAL_COMPLETED,
      data: { goalId: goal._id.toString() },
      dedupeKey: `goal_completed:${goal._id}`
    });

    await evaluateBadges(goal.user);
  } else if (becameIncomplete) {
    await removeActivity({
      user: goal.user,
      type: ACTIVITY_TYPE.GOAL_COMPLETED,
      refId: goal._id
    });
  }

  return goal;
};

export const recomputeAllForUser = async (userId) => {
  const goals = await Goal.find({ user: userId, isDeleted: false }).select('_id');

  const results = await Promise.all(goals.map((goal) => recomputeGoalProgress(goal._id, { silent: true })));

  return results.filter(Boolean).length;
};
