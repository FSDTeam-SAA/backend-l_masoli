import User from '../models/user.model.js';
import Milestone from '../models/milestone.model.js';
import { dayKey, nextDayKey, previousDayKey, safeTimezone } from '../utils/dateHelper.js';

export const readStreak = (user) => {
  const timezone = safeTimezone(user.timezone);
  const todayKey = dayKey(new Date(), timezone);
  const lastKey = user.streak?.lastActiveDate ? dayKey(user.streak.lastActiveDate, timezone) : null;

  const isAlive = lastKey === todayKey || lastKey === previousDayKey(todayKey);
  const current = isAlive ? user.streak?.current || 0 : 0;
  const longest = user.streak?.longest || 0;

  return {
    current,
    longest,
    isPersonalBest: current > 0 && current === longest,
    lastActiveDate: user.streak?.lastActiveDate || null
  };
};

export const touchStreak = async (user, at = new Date()) => {
  const timezone = safeTimezone(user.timezone);
  const todayKey = dayKey(at, timezone);
  const lastKey = user.streak?.lastActiveDate ? dayKey(user.streak.lastActiveDate, timezone) : null;

  if (lastKey === todayKey) {
    return readStreak(user);
  }

  const current = lastKey === previousDayKey(todayKey) ? (user.streak?.current || 0) + 1 : 1;
  const longest = Math.max(user.streak?.longest || 0, current);

  user.streak = { current, longest, lastActiveDate: at };
  await User.updateOne({ _id: user._id }, { streak: user.streak });

  return readStreak(user);
};

export const rebuildStreak = async (user) => {
  const timezone = safeTimezone(user.timezone);

  const rows = await Milestone.aggregate([
    { $match: { user: user._id, isDeleted: false, isCompleted: true, completedAt: { $ne: null } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const keys = rows.map((row) => row._id);

  if (keys.length === 0) {
    user.streak = { current: 0, longest: 0, lastActiveDate: null };
    await User.updateOne({ _id: user._id }, { streak: user.streak });
    return readStreak(user);
  }

  let longest = 1;
  let run = 1;

  for (let index = 1; index < keys.length; index += 1) {
    run = keys[index] === nextDayKey(keys[index - 1]) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const lastKey = keys[keys.length - 1];
  const todayKey = dayKey(new Date(), timezone);
  const isAlive = lastKey === todayKey || lastKey === previousDayKey(todayKey);

  user.streak = {
    current: isAlive ? run : 0,
    longest,
    lastActiveDate: new Date(`${lastKey}T12:00:00.000Z`)
  };

  await User.updateOne({ _id: user._id }, { streak: user.streak });

  return readStreak(user);
};
