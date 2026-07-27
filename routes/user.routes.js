import { Router } from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as userController from '../controllers/user.controller.js';
import * as userValidation from '../validations/user.validation.js';

const router = Router();

router.use(auth());

router.get('/me', userController.getMe);
router.patch('/me', validateRequest(userValidation.updateProfileSchema), userController.updateMe);
router.patch('/me/avatar', upload.single('avatar'), userController.updateAvatar);
router.delete('/me/avatar', userController.removeAvatar);
router.get('/me/stats', userController.getMyStats);
router.get('/me/completed-goals', userController.getMyCompletedGoals);
router.delete('/me', validateRequest(userValidation.deleteAccountSchema), userController.deleteMe);

export default router;
