import { Router } from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as boardController from '../controllers/visionBoard.controller.js';
import * as dreamController from '../controllers/dream.controller.js';
import * as boardValidation from '../validations/visionBoard.validation.js';
import * as dreamValidation from '../validations/dream.validation.js';
import { MAX_BOARD_IMAGES_PER_UPLOAD } from '../constants/index.js';

const router = Router();

router.use(auth());

router
  .route('/')
  .get(boardController.listBoards)
  .post(
    upload.fields([
      { name: 'images', maxCount: MAX_BOARD_IMAGES_PER_UPLOAD },
      { name: 'cover', maxCount: 1 }
    ]),
    validateRequest(boardValidation.createBoardSchema),
    boardController.createBoard
  );

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

router.post(
  '/:id/dreams/bulk',
  upload.array('images', MAX_BOARD_IMAGES_PER_UPLOAD),
  dreamController.createManyDreams
);

router
  .route('/:id/dreams')
  .get(dreamController.listDreams)
  .post(upload.single('image'), validateRequest(dreamValidation.createDreamSchema), dreamController.createDream);

router.get('/:id/dreams/:dreamId/goals', dreamController.listDreamGoals);

router
  .route('/:id/dreams/:dreamId')
  .get(dreamController.getDream)
  .patch(upload.single('image'), validateRequest(dreamValidation.updateDreamSchema), dreamController.updateDream)
  .delete(dreamController.deleteDream);

export default router;
