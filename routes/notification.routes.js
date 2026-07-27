import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as userValidation from '../validations/user.validation.js';

const router = Router();

router.use(auth());

router
  .route('/device-token')
  .post(validateRequest(userValidation.deviceTokenSchema), notificationController.registerDeviceToken)
  .delete(validateRequest(userValidation.removeDeviceTokenSchema), notificationController.removeDeviceToken);

router.get('/', notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
