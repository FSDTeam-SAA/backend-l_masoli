import { z } from 'zod';
import { objectId } from './common.validation.js';
import { COLLAGE_LAYOUT_KEYS } from '../constants/index.js';

export const createBoardSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    coverMood: objectId.optional(),
    collageLayout: z.enum(COLLAGE_LAYOUT_KEYS).optional()
  })
});

export const updateBoardSchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    coverMood: objectId.optional(),
    collageLayout: z.enum(COLLAGE_LAYOUT_KEYS).optional()
  })
});

export const collageLayoutSchema = z.object({
  body: z.object({ collageLayout: z.enum(COLLAGE_LAYOUT_KEYS) })
});

export const reorderImagesSchema = z.object({
  body: z.object({
    items: z
      .array(z.object({ id: objectId, order: z.coerce.number().int() }))
      .min(1, 'At least one image is required')
  })
});
