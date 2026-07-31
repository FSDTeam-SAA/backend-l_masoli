import { z } from 'zod';
import { objectId } from './common.validation.js';
import { GOAL_STATUS_VALUES } from '../constants/index.js';

export const createGoalSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').trim(),
    description: z.string().trim().optional(),
    dream: objectId.nullish(),
    areaOfLife: objectId,
    priority: objectId,
    targetDate: z.coerce.date()
  })
});

export const updateGoalSchema = z.object({
  body: z.object({
    title: z.string().min(2).trim().optional(),
    description: z.string().trim().optional(),
    dream: objectId.nullish(),
    areaOfLife: objectId.optional(),
    priority: objectId.optional(),
    targetDate: z.coerce.date().optional()
  })
});

export const completeGoalSchema = z.object({
  body: z.object({ isCompleted: z.coerce.boolean() })
});

export const archiveGoalSchema = z.object({
  body: z.object({ isArchived: z.coerce.boolean() })
});

export const listGoalsSchema = z.object({
  query: z.object({
    searchTerm: z.string().optional(),
    areaOfLife: objectId.optional(),
    priority: objectId.optional(),
    status: z.enum([...GOAL_STATUS_VALUES, 'all']).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
});
