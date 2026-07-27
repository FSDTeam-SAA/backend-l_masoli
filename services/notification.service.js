import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { sendToUser } from './push.service.js';
import { ADMIN_ROLES, NOTIFICATION_AUDIENCE, USER_STATUS } from '../constants/index.js';

const isDuplicateKeyError = (error) => error && error.code === 11000;

export const createNotification = async ({
  user,
  title,
  body = '',
  type,
  data = {},
  audience = NOTIFICATION_AUDIENCE.USER,
  dedupeKey = null,
  push = true
}) => {
  try {
    const notification = await Notification.create({
      user,
      title,
      body,
      type,
      data,
      audience,
      dedupeKey
    });

    if (push) {
      const delivered = await sendToUser(user, { title, body, data: { ...data, type } });

      if (delivered) {
        await Notification.updateOne({ _id: notification._id }, { sentPush: true });
      }
    }

    return notification;
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;

    console.error('Failed to create notification:', error.message);
    return null;
  }
};

export const createManyNotifications = async (payloads) => {
  const created = await Promise.all(payloads.map((payload) => createNotification(payload)));
  return created.filter(Boolean);
};

export const notifyAdmins = async ({ title, body, type, data = {}, dedupeKey = null }) => {
  const admins = await User.find({
    role: { $in: ADMIN_ROLES },
    isDeleted: false,
    status: USER_STATUS.ACTIVE
  }).select('_id');

  return createManyNotifications(
    admins.map((admin) => ({
      user: admin._id,
      title,
      body,
      type,
      data,
      audience: NOTIFICATION_AUDIENCE.ADMIN,
      dedupeKey: dedupeKey ? `${dedupeKey}:${admin._id}` : null,
      push: false
    }))
  );
};
