import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as dreamController from '../controllers/dream.controller.js';
import * as dreamValidation from '../validations/dream.validation.js';

const router = Router();

router.use(auth());

router.get('/', validateRequest(dreamValidation.listAllDreamsSchema), dreamController.listAllDreams);

export default router;
