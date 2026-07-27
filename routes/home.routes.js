import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as homeController from '../controllers/home.controller.js';

const router = Router();

router.use(auth());

router.get('/', homeController.getHome);
router.get('/motivation', homeController.getMotivation);
router.get('/upcoming-milestones', homeController.getUpcomingMilestones);

export default router;
