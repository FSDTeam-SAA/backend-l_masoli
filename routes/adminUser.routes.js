import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as adminUserController from '../controllers/adminUser.controller.js';
import * as adminUserValidation from '../validations/adminUser.validation.js';
import { ADMIN_ROLES } from '../constants/index.js';

const router = Router();

router.use(auth(...ADMIN_ROLES));

router
  .route('/')
  .get(validateRequest(adminUserValidation.listUsersSchema), adminUserController.listUsers)
  .post(validateRequest(adminUserValidation.createUserSchema), adminUserController.createUser);

router
  .route('/:id')
  .get(adminUserController.getUser)
  .patch(validateRequest(adminUserValidation.updateUserSchema), adminUserController.updateUser)
  .delete(adminUserController.deleteUser);

router.patch(
  '/:id/status',
  validateRequest(adminUserValidation.updateStatusSchema),
  adminUserController.updateUserStatus
);
router.patch(
  '/:id/role',
  validateRequest(adminUserValidation.updateRoleSchema),
  adminUserController.updateUserRole
);
router.patch(
  '/:id/subscription',
  validateRequest(adminUserValidation.updateSubscriptionSchema),
  adminUserController.updateUserSubscription
);

export default router;
