import User from '../models/user.model.js';
import Milestone from '../models/milestone.model.js';
import Goal from '../models/goal.model.js';
import ProgressSnapshot from '../models/progressSnapshot.model.js';
import { GOAL_STATUS, ROLES, USER_STATUS } from '../constants/index.js';
import { overallProgress } from '../services/analytics.service.js';
import { dayKey } from '../utils/dateHelper.js';

const runProgressSnapshot = async () => {
  const users = await User.find({
    role: ROLES.USER,
    isDeleted: false,
    status: USER_STATUS.ACTIVE
  }).select('_id timezone');

  const operations = [];

  for (const user of users) {
    const [overallPercent, completedGoals, completedMilestones, totalMilestones] = await Promise.all([
      overallProgress(user._id),
      Goal.countDocuments({ user: user._id, isDeleted: false, status: GOAL_STATUS.COMPLETED }),
      Milestone.countDocuments({ user: user._id, isDeleted: false, isCompleted: true }),
      Milestone.countDocuments({ user: user._id, isDeleted: false })
    ]);

    operations.push({
      updateOne: {
        filter: { user: user._id, dayKey: dayKey(new Date(), user.timezone) },
        update: {
          $set: { overallPercent, completedGoals, completedMilestones, totalMilestones }
        },
        upsert: true
      }
    });
  }

  if (operations.length > 0) {
    await ProgressSnapshot.bulkWrite(operations);
  }

  console.log(`[cron] progress snapshots written: ${operations.length}`);

  return operations.length;
};

export default runProgressSnapshot;
