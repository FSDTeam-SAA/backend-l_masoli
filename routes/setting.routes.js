import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as settingController from '../controllers/setting.controller.js';
import * as userValidation from '../validations/user.validation.js';

const router = Router();

router.use(auth());

router.get('/', settingController.getSettings);
router.patch(
  '/notifications',
  validateRequest(userValidation.notificationSettingsSchema),
  settingController.updateNotificationSettings
);

export default router;
