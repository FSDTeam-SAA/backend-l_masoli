import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as adminDashboardController from '../controllers/adminDashboard.controller.js';
import * as adminUserValidation from '../validations/adminUser.validation.js';
import { ADMIN_ROLES } from '../constants/index.js';

const router = Router();

router.use(auth(...ADMIN_ROLES));
router.use(validateRequest(adminUserValidation.dashboardQuerySchema));

router.get('/stats', adminDashboardController.getStats);
router.get('/registration-rate', adminDashboardController.getRegistrationRate);
router.get('/user-growth', adminDashboardController.getUserGrowth);
router.get('/recent-users', adminDashboardController.getRecentUsers);
router.get('/overview', adminDashboardController.getOverview);

export default router;
