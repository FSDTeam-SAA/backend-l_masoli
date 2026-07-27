import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as adminNotificationController from '../controllers/adminNotification.controller.js';
import * as adminUserValidation from '../validations/adminUser.validation.js';
import { ADMIN_ROLES } from '../constants/index.js';

const router = Router();

router.use(auth(...ADMIN_ROLES));

router.get('/', adminNotificationController.listNotifications);
router.get('/unread-count', adminNotificationController.getUnreadCount);
router.patch('/read-all', adminNotificationController.markAllAsRead);
router.patch('/:id/read', adminNotificationController.markAsRead);
router.post('/broadcast', validateRequest(adminUserValidation.broadcastSchema), adminNotificationController.broadcast);

export default router;
