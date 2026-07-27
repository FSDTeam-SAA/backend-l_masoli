import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import * as goalController from '../controllers/goal.controller.js';
import * as goalValidation from '../validations/goal.validation.js';
import * as milestoneValidation from '../validations/milestone.validation.js';

const router = Router();

router.use(auth());

router
  .route('/')
  .get(validateRequest(goalValidation.listGoalsSchema), goalController.listGoals)
  .post(validateRequest(goalValidation.createGoalSchema), goalController.createGoal);

router
  .route('/:id')
  .get(goalController.getGoal)
  .patch(validateRequest(goalValidation.updateGoalSchema), goalController.updateGoal)
  .delete(goalController.deleteGoal);

router.patch(
  '/:id/complete',
  validateRequest(goalValidation.completeGoalSchema),
  goalController.setGoalCompletion
);
router.patch('/:id/archive', validateRequest(goalValidation.archiveGoalSchema), goalController.setGoalArchive);

router
  .route('/:id/milestones')
  .get(goalController.listGoalMilestones)
  .post(validateRequest(milestoneValidation.createMilestoneSchema), goalController.createGoalMilestone);

export default router;
