import { Router } from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as boardController from '../controllers/visionBoard.controller.js';
import * as dreamController from '../controllers/dream.controller.js';
import * as boardValidation from '../validations/visionBoard.validation.js';
import * as dreamValidation from '../validations/dream.validation.js';

const router = Router();

router.use(auth());

router
  .route('/')
  .get(boardController.listBoards)
  // upload.any() because a dream's files arrive under a per-dream field name
  // (images_0, images_1, ...) alongside the board's own `cover` file - see
  // utils/dreamUploads.js.
  .post(upload.any(), validateRequest(boardValidation.createBoardSchema), boardController.createBoard);

router
  .route('/:id')
  .get(boardController.getBoard)
  .patch(validateRequest(boardValidation.updateBoardSchema), boardController.updateBoard)
  .delete(boardController.deleteBoard);

router.patch(
  '/:id/collage',
  validateRequest(boardValidation.collageLayoutSchema),
  boardController.updateCollageLayout
);

router.patch(
  '/:id/dreams/reorder',
  validateRequest(dreamValidation.reorderDreamsSchema),
  dreamController.reorderDreams
);

router.post('/:id/dreams/bulk', upload.any(), dreamController.createManyDreams);

router
  .route('/:id/dreams')
  .get(dreamController.listDreams)
  .post(upload.any(), validateRequest(dreamValidation.createDreamSchema), dreamController.createDream);

router.get('/:id/dreams/:dreamId/goals', dreamController.listDreamGoals);

router
  .route('/:id/dreams/:dreamId')
  .get(dreamController.getDream)
  .patch(upload.any(), validateRequest(dreamValidation.updateDreamSchema), dreamController.updateDream)
  .delete(dreamController.deleteDream);

export default router;
