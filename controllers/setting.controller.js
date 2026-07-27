import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import User from '../models/user.model.js';
import StaticPage from '../models/staticPage.model.js';

export const getSettings = catchAsync(async (req, res) => {
  const pages = await StaticPage.find().select('slug title').sort({ slug: 1 });

  sendResponse(res, {
    message: 'Settings retrieved successfully',
    data: {
      notificationSettings: req.user.notificationSettings,
      timezone: req.user.timezone,
      helpAndSupport: pages
    }
  });
});

export const updateNotificationSettings = catchAsync(async (req, res) => {
  const payload = pick(req.body, ['goalReminders', 'milestoneReminders', 'dailyInspiration']);

  const user = await User.findById(req.user._id);
  user.notificationSettings = { ...user.notificationSettings.toObject(), ...payload };
  await user.save();

  sendResponse(res, {
    message: 'Notification preferences updated successfully',
    data: user.notificationSettings
  });
});
