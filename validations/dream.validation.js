import { z } from 'zod';
import { objectId } from './common.validation.js';

export const createDreamSchema = z.object({
  body: z.object({
    title: z.string().trim().max(120, 'Title must be at most 120 characters').optional(),
    story: z.string().trim().max(2000, 'Dream story must be at most 2000 characters').optional(),
    areaOfLife: objectId.nullish(),
    order: z.coerce.number().int().optional()
  })
});

export const updateDreamSchema = z.object({
  body: z.object({
    title: z.string().trim().max(120).optional(),
    story: z.string().trim().max(2000).optional(),
    areaOfLife: objectId.nullish(),
    order: z.coerce.number().int().optional()
  })
});

export const listAllDreamsSchema = z.object({
  query: z.object({
    searchTerm: z.string().optional(),
    board: objectId.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
});

export const reorderDreamsSchema = z.object({
  body: z.object({
    items: z
      .array(z.object({ id: objectId, order: z.coerce.number().int() }))
      .min(1, 'At least one dream is required')
  })
});
