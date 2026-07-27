import ActivityLog from '../models/activityLog.model.js';
import { dayKey } from '../utils/dateHelper.js';

export const logActivity = async ({ user, type, refId = null, refModel = null, date = new Date() }) => {
  if (!user) return null;

  try {
    return await ActivityLog.create({
      user: user._id || user,
      type,
      refId,
      refModel,
      date,
      dayKey: dayKey(date, user.timezone || 'UTC')
    });
  } catch (error) {
    console.error('Failed to write activity log:', error.message);
    return null;
  }
};

export const removeActivity = async ({ user, type, refId }) => {
  if (!user || !refId) return;

  try {
    await ActivityLog.deleteMany({ user: user._id || user, type, refId });
  } catch (error) {
    console.error('Failed to remove activity log:', error.message);
  }
};
