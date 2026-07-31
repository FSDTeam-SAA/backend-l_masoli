import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as contentController from '../controllers/content.controller.js';
import * as adminContentValidation from '../validations/adminContent.validation.js';

const router = Router();

router.get('/pages', contentController.getPages);
router.get('/pages/:slug', contentController.getPageBySlug);

router
  .route('/areas')
  .get(auth(), contentController.getAreas)
  .post(auth(), validateRequest(adminContentValidation.createAreaSchema), contentController.createMyArea);

router
  .route('/areas/:id')
  .patch(auth(), validateRequest(adminContentValidation.updateAreaSchema), contentController.updateMyArea)
  .delete(auth(), contentController.deleteMyArea);

router.get('/priorities', auth(), contentController.getPriorities);
router.get('/cover-moods', auth(), contentController.getCoverMoods);
router.get('/collage-layouts', auth(), contentController.getCollageLayouts);
router.get('/quotes/random', auth(), contentController.getRandomQuote);

export default router;
