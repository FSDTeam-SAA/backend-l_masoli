import { Router } from 'express';
import auth from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as boardController from '../controllers/visionBoard.controller.js';
import * as boardValidation from '../validations/visionBoard.validation.js';
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

router
  .route('/:id/images')
  .get(boardController.listBoardImages)
  .post(upload.array('images', MAX_BOARD_IMAGES_PER_UPLOAD), boardController.addBoardImages);

router.patch(
  '/:id/images/reorder',
  validateRequest(boardValidation.reorderImagesSchema),
  boardController.reorderBoardImages
);

router
  .route('/:id/images/:imageId')
  .get(boardController.getBoardImage)
  .delete(boardController.deleteBoardImage);

router.patch(
  '/:id/collage',
  validateRequest(boardValidation.collageLayoutSchema),
  boardController.updateCollageLayout
);

export default router;
