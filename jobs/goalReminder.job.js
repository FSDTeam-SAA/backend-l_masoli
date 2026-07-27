import Goal from '../models/goal.model.js';
import { GOAL_STATUS, NOTIFICATION_TYPE } from '../constants/index.js';
import { createNotification } from '../services/notification.service.js';
import { addDays, dayKey, endOfDayUtc, startOfDayUtc } from '../utils/dateHelper.js';
import { relativeDueLabel } from '../utils/labelHelper.js';

const OFFSETS = [7, 3, 1];

const runGoalReminders = async () => {
  const now = new Date();
  let sent = 0;

  for (const offset of OFFSETS) {
    const target = addDays(now, offset);

    const goals = await Goal.find({
      isDeleted: false,
      status: GOAL_STATUS.ACTIVE,
      targetDate: { $gte: startOfDayUtc(target), $lte: endOfDayUtc(target) }
    }).populate({ path: 'user', select: 'notificationSettings timezone isDeleted' });

    for (const goal of goals) {
      const user = goal.user;

      if (!user || user.isDeleted || !user.notificationSettings?.goalReminders) continue;

      const created = await createNotification({
        user: user._id,
        title: 'Goal deadline approaching',
        body: `"${goal.title}" is due ${relativeDueLabel(goal.targetDate, user.timezone).toLowerCase()} and is ${goal.progress}% complete`,
        type: NOTIFICATION_TYPE.GOAL_REMINDER,
        data: { goalId: goal._id.toString() },
        dedupeKey: `goal_reminder:${goal._id}:d${offset}`
      });

      if (created) sent += 1;
    }
  }

  console.log(`[cron] goal reminders sent: ${sent} (${dayKey(now, 'UTC')})`);

  return sent;
};

export default runGoalReminders;
