import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as contentController from '../controllers/content.controller.js';

const router = Router();

router.get('/pages', contentController.getPages);
router.get('/pages/:slug', contentController.getPageBySlug);

router.get('/areas', auth(), contentController.getAreas);
router.get('/priorities', auth(), contentController.getPriorities);
router.get('/cover-moods', auth(), contentController.getCoverMoods);
router.get('/collage-layouts', auth(), contentController.getCollageLayouts);
router.get('/quotes/random', auth(), contentController.getRandomQuote);

export default router;
