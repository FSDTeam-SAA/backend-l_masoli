import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import User from '../models/user.model.js';
import { NOTIFICATION_AUDIENCE, NOTIFICATION_TYPE, ROLES, USER_STATUS } from '../constants/index.js';
import { createManyNotifications } from '../services/notification.service.js';
import {
  buildListHandler,
  buildMarkAllReadHandler,
  buildMarkReadHandler,
  buildUnreadCountHandler
} from './notification.controller.js';

export const listNotifications = buildListHandler(NOTIFICATION_AUDIENCE.ADMIN);
export const getUnreadCount = buildUnreadCountHandler(NOTIFICATION_AUDIENCE.ADMIN);
export const markAsRead = buildMarkReadHandler(NOTIFICATION_AUDIENCE.ADMIN);
export const markAllAsRead = buildMarkAllReadHandler(NOTIFICATION_AUDIENCE.ADMIN);

export const broadcast = catchAsync(async (req, res) => {
  const recipients = await User.find({
    role: ROLES.USER,
    isDeleted: false,
    status: USER_STATUS.ACTIVE
  }).select('_id');

  const created = await createManyNotifications(
    recipients.map((recipient) => ({
      user: recipient._id,
      title: req.body.title,
      body: req.body.body || '',
      type: NOTIFICATION_TYPE.ANNOUNCEMENT,
      audience: NOTIFICATION_AUDIENCE.USER
    }))
  );

  sendResponse(res, {
    message: `Announcement sent to ${created.length} user${created.length === 1 ? '' : 's'}`,
    data: { recipients: created.length }
  });
});
