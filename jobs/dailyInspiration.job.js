import User from '../models/user.model.js';
import MotivationQuote from '../models/motivationQuote.model.js';
import { NOTIFICATION_TYPE, ROLES, USER_STATUS } from '../constants/index.js';
import { createNotification } from '../services/notification.service.js';
import { dayKey } from '../utils/dateHelper.js';

const runDailyInspiration = async () => {
  const [quote] = await MotivationQuote.aggregate([{ $match: { isActive: true } }, { $sample: { size: 1 } }]);

  if (!quote) {
    console.log('[cron] daily inspiration skipped: no active quotes');
    return 0;
  }

  const users = await User.find({
    role: ROLES.USER,
    isDeleted: false,
    status: USER_STATUS.ACTIVE,
    'notificationSettings.dailyInspiration': true
  }).select('_id timezone');

  let sent = 0;

  for (const user of users) {
    const created = await createNotification({
      user: user._id,
      title: "Today's motivation",
      body: quote.text,
      type: NOTIFICATION_TYPE.DAILY_INSPIRATION,
      data: { quoteId: quote._id.toString() },
      dedupeKey: `daily_inspiration:${user._id}:${dayKey(new Date(), user.timezone)}`
    });

    if (created) sent += 1;
  }

  console.log(`[cron] daily inspiration sent: ${sent}`);

  return sent;
};

export default runDailyInspiration;
