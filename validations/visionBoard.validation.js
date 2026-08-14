import { z } from 'zod';
import { objectId } from './common.validation.js';
import { COLLAGE_LAYOUT_KEYS } from '../constants/index.js';

export const createBoardSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    coverMood: objectId.optional(),
    collageLayout: z.enum(COLLAGE_LAYOUT_KEYS).optional(),
    // JSON array of `{ title, story }`, one per dream created with the board;
    // the matching image files arrive as images_0, images_1, ... See
    // utils/dreamUploads.js. Parsed there, so it stays a raw string here.
    dreams: z.string().optional(),
    title: z.union([z.string(), z.array(z.string())]).optional(),
    story: z.union([z.string(), z.array(z.string())]).optional()
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
