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

/// Multipart carries every field as text, so the string 'false' must read as
/// false — which z.coerce.boolean() (used on the JSON-only endpoints) would
/// turn into true.
const multipartBoolean = z.preprocess(
  (value) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value),
  z.boolean()
);

export const updateDreamSchema = z.object({
  body: z.object({
    title: z.string().trim().max(120).optional(),
    story: z.string().trim().max(2000).optional(),
    areaOfLife: objectId.nullish(),
    order: z.coerce.number().int().optional(),
    // Promotes an already-uploaded image to cover by moving it to images[0].
    coverIndex: z.coerce.number().int().min(0).optional(),
    // Sent alongside a single uploaded file to swap images[0] alone; without
    // it an upload replaces the dream's whole image set.
    replaceCover: multipartBoolean.optional()
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
