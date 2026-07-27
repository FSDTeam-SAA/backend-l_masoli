import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import Notification from '../models/notification.model.js';
import DeviceToken from '../models/deviceToken.model.js';
import { NOTIFICATION_AUDIENCE } from '../constants/index.js';
import { relativeUpdatedLabel } from '../utils/labelHelper.js';

const decorate = (notification) => ({
  ...(typeof notification.toObject === 'function' ? notification.toObject() : notification),
  timeLabel: relativeUpdatedLabel(notification.createdAt)
});

export const buildListHandler = (audience) =>
  catchAsync(async (req, res) => {
    const filter = { user: req.user._id, audience };

    if (req.query.isRead === 'true') filter.isRead = true;
    if (req.query.isRead === 'false') filter.isRead = false;
    if (req.query.type) filter.type = req.query.type;

    const builder = new QueryBuilder(Notification.find(filter), req.query).sort('-createdAt').paginate();

    const [notifications, meta, unreadCount] = await Promise.all([
      builder.modelQuery,
      builder.countTotal(),
      Notification.countDocuments({ user: req.user._id, audience, isRead: false })
    ]);

    sendResponse(res, {
      message: 'Notifications retrieved successfully',
      meta: { ...meta, unreadCount },
      data: notifications.map(decorate)
    });
  });

export const buildUnreadCountHandler = (audience) =>
  catchAsync(async (req, res) => {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      audience,
      isRead: false
    });

    sendResponse(res, {
      message: 'Unread count retrieved successfully',
      data: { unreadCount }
    });
  });

export const buildMarkReadHandler = (audience) =>
  catchAsync(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, audience },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
    }

    sendResponse(res, { message: 'Notification marked as read', data: decorate(notification) });
  });

export const buildMarkAllReadHandler = (audience) =>
  catchAsync(async (req, res) => {
    const result = await Notification.updateMany(
      { user: req.user._id, audience, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    sendResponse(res, {
      message: 'All notifications marked as read',
      data: { updated: result.modifiedCount }
    });
  });

export const listNotifications = buildListHandler(NOTIFICATION_AUDIENCE.USER);
export const getUnreadCount = buildUnreadCountHandler(NOTIFICATION_AUDIENCE.USER);
export const markAsRead = buildMarkReadHandler(NOTIFICATION_AUDIENCE.USER);
export const markAllAsRead = buildMarkAllReadHandler(NOTIFICATION_AUDIENCE.USER);

export const deleteNotification = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id
  });

  if (!notification) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  }

  sendResponse(res, { message: 'Notification deleted successfully' });
});

export const registerDeviceToken = catchAsync(async (req, res) => {
  const deviceToken = await DeviceToken.findOneAndUpdate(
    { token: req.body.token },
    {
      user: req.user._id,
      token: req.body.token,
      platform: req.body.platform || 'android',
      lastUsedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Device registered for push notifications',
    data: deviceToken
  });
});

export const removeDeviceToken = catchAsync(async (req, res) => {
  await DeviceToken.deleteOne({ token: req.body.token, user: req.user._id });

  sendResponse(res, { message: 'Device unregistered successfully' });
});
