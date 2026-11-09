import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as achievementController from '../controllers/achievement.controller.js';
import { createRequire } from 'module';

var require = createRequire(import.meta.url);
var module = { exports: {} };

const router = Router();

router.use(auth());

router.get('/', achievementController.getAchievements);
router.get('/summary', achievementController.getAchievementSummary);

export default router;