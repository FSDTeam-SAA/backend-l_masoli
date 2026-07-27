import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as progressController from '../controllers/progress.controller.js';

const router = Router();

router.use(auth());

router.get('/', progressController.getProgress);
router.get('/chart', progressController.getChart);
router.get('/streak', progressController.getStreak);

export default router;
