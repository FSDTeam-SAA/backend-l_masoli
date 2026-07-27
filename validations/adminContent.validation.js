import { z } from 'zod';
import { PAGE_SLUG_VALUES } from '../constants/index.js';

export const createAreaSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').trim(),
    icon: z.string().trim().optional(),
    color: z.string().trim().optional(),
    order: z.coerce.number().int().optional()
  })
});

export const updateAreaSchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    icon: z.string().trim().optional(),
    color: z.string().trim().optional(),
    order: z.coerce.number().int().optional(),
    isActive: z.coerce.boolean().optional()
  })
});

export const createPrioritySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').trim(),
    color: z.string().trim().optional(),
    weight: z.coerce.number().int().min(1).optional(),
    order: z.coerce.number().int().optional()
  })
});

export const updatePrioritySchema = z.object({
  body: z.object({
    name: z.string().min(1).trim().optional(),
    color: z.string().trim().optional(),
    weight: z.coerce.number().int().min(1).optional(),
    order: z.coerce.number().int().optional(),
    isActive: z.coerce.boolean().optional()
  })
});

export const createQuoteSchema = z.object({
  body: z.object({
    text: z.string().min(4, 'Quote must be at least 4 characters').trim(),
    author: z.string().trim().optional()
  })
});

export const updateQuoteSchema = z.object({
  body: z.object({
    text: z.string().min(4).trim().optional(),
    author: z.string().trim().optional(),
    isActive: z.coerce.boolean().optional()
  })
});

export const updatePageSchema = z.object({
  params: z.object({ slug: z.enum(PAGE_SLUG_VALUES) }),
  body: z.object({
    title: z.string().min(2).trim().optional(),
    content: z.string().min(1, 'Content is required')
  })
});
