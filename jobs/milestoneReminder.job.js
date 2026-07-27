import Milestone from '../models/milestone.model.js';
import { NOTIFICATION_TYPE } from '../constants/index.js';
import { createNotification } from '../services/notification.service.js';
import { addDays, dayKey, endOfDayUtc, startOfDayUtc } from '../utils/dateHelper.js';
import { relativeDueLabel } from '../utils/labelHelper.js';

const OFFSETS = [3, 1, 0];

const runMilestoneReminders = async () => {
  const now = new Date();
  let sent = 0;

  for (const offset of OFFSETS) {
    const target = addDays(now, offset);

    const milestones = await Milestone.find({
      isDeleted: false,
      isCompleted: false,
      dueDate: { $gte: startOfDayUtc(target), $lte: endOfDayUtc(target) }
    })
      .populate({ path: 'goal', select: 'title isDeleted' })
      .populate({ path: 'user', select: 'notificationSettings timezone isDeleted status' });

    for (const milestone of milestones) {
      const user = milestone.user;

      if (!user || user.isDeleted || !user.notificationSettings?.milestoneReminders) continue;
      if (!milestone.goal || milestone.goal.isDeleted) continue;

      const created = await createNotification({
        user: user._id,
        title: 'Milestone coming up',
        body: `"${milestone.title}" is due ${relativeDueLabel(milestone.dueDate, user.timezone).toLowerCase()}`,
        type: NOTIFICATION_TYPE.MILESTONE_REMINDER,
        data: {
          milestoneId: milestone._id.toString(),
          goalId: milestone.goal._id.toString()
        },
        dedupeKey: `milestone_reminder:${milestone._id}:d${offset}`
      });

      if (created) {
        sent += 1;
        await Milestone.updateOne({ _id: milestone._id }, { reminderSentAt: new Date() });
      }
    }
  }

  console.log(`[cron] milestone reminders sent: ${sent} (${dayKey(now, 'UTC')})`);

  return sent;
};

export default runMilestoneReminders;
