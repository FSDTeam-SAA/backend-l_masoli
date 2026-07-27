import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as milestoneController from '../controllers/milestone.controller.js';
import * as milestoneValidation from '../validations/milestone.validation.js';

const router = Router();

router.use(auth());

router.post('/', validateRequest(milestoneValidation.createMilestoneSchema), milestoneController.createMilestone);
router.get('/upcoming', milestoneController.getUpcomingMilestones);
router.patch(
  '/reorder',
  validateRequest(milestoneValidation.reorderMilestonesSchema),
  milestoneController.reorderMilestones
);

router
  .route('/:id')
  .get(milestoneController.getMilestone)
  .patch(validateRequest(milestoneValidation.updateMilestoneSchema), milestoneController.updateMilestone)
  .delete(milestoneController.deleteMilestone);

router.patch('/:id/toggle', milestoneController.toggleMilestone);

export default router;
