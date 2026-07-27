import { z } from 'zod';
import { objectId } from './common.validation.js';

export const createMilestoneSchema = z.object({
  body: z.object({
    goal: objectId.optional(),
    title: z.string().min(2, 'Title must be at least 2 characters').trim(),
    dueDate: z.coerce.date(),
    order: z.coerce.number().int().optional()
  })
});

export const updateMilestoneSchema = z.object({
  body: z.object({
    title: z.string().min(2).trim().optional(),
    dueDate: z.coerce.date().optional(),
    order: z.coerce.number().int().optional()
  })
});

export const reorderMilestonesSchema = z.object({
  body: z.object({
    items: z
      .array(z.object({ id: objectId, order: z.coerce.number().int() }))
      .min(1, 'At least one milestone is required')
  })
});
