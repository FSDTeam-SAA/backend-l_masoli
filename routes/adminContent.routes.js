import { Router } from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as adminContentController from '../controllers/adminContent.controller.js';
import * as adminContentValidation from '../validations/adminContent.validation.js';
import { ADMIN_ROLES, MAX_BOARD_IMAGES_PER_UPLOAD } from '../constants/index.js';

const router = Router();

router.use(auth(...ADMIN_ROLES));

router
  .route('/areas')
  .get(adminContentController.listAreas)
  .post(validateRequest(adminContentValidation.createAreaSchema), adminContentController.createArea);

router
  .route('/areas/:id')
  .patch(validateRequest(adminContentValidation.updateAreaSchema), adminContentController.updateArea)
  .delete(adminContentController.deleteArea);

router
  .route('/priorities')
  .get(adminContentController.listPriorities)
  .post(validateRequest(adminContentValidation.createPrioritySchema), adminContentController.createPriority);

router
  .route('/priorities/:id')
  .patch(validateRequest(adminContentValidation.updatePrioritySchema), adminContentController.updatePriority)
  .delete(adminContentController.deletePriority);

router
  .route('/quotes')
  .get(adminContentController.listQuotes)
  .post(validateRequest(adminContentValidation.createQuoteSchema), adminContentController.createQuote);

router
  .route('/quotes/:id')
  .patch(validateRequest(adminContentValidation.updateQuoteSchema), adminContentController.updateQuote)
  .delete(adminContentController.deleteQuote);

router
  .route('/cover-moods')
  .get(adminContentController.listCoverMoods)
  .post(upload.array('images', MAX_BOARD_IMAGES_PER_UPLOAD), adminContentController.createCoverMoods);

router.delete('/cover-moods/:id', adminContentController.deleteCoverMood);

router
  .route('/pages/:slug')
  .get(adminContentController.getPage)
  .put(validateRequest(adminContentValidation.updatePageSchema), adminContentController.updatePage);

export default router;
