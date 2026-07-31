import { z } from 'zod';
import { email, password } from './common.validation.js';
import { ROLE_VALUES, SUBSCRIPTION_TIER_VALUES, USER_STATUS_VALUES } from '../constants/index.js';

export const listUsersSchema = z.object({
  query: z.object({
    searchTerm: z.string().optional(),
    role: z.enum([...ROLE_VALUES, 'all']).optional(),
    status: z.enum([...USER_STATUS_VALUES, 'all']).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
});

export const updateStatusSchema = z.object({
  body: z.object({ status: z.enum(USER_STATUS_VALUES) })
});

export const updateRoleSchema = z.object({
  body: z.object({ role: z.enum(ROLE_VALUES) })
});

export const updateSubscriptionSchema = z.object({
  body: z.object({
    tier: z.enum(SUBSCRIPTION_TIER_VALUES),
    expiresAt: z.coerce.date().nullish()
  })
});

export const updateUserSchema = z.object({
  body: z.object({
    userName: z.string().min(2).trim().optional(),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    bio: z.string().max(500).optional(),
    dateOfBirth: z.coerce.date().optional(),
    status: z.enum(USER_STATUS_VALUES).optional()
  })
});

export const createUserSchema = z.object({
  body: z.object({
    userName: z.string().min(2, 'Name must be at least 2 characters').trim(),
    email,
    phone: z.string().trim().optional(),
    password,
    role: z.enum(ROLE_VALUES).optional()
  })
});

export const dashboardQuerySchema = z.object({
  query: z.object({
    week: z.enum(['current', 'previous']).optional(),
    start: z.string().optional(),
    year: z.coerce.number().int().min(2000).max(2200).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional()
  })
});

export const broadcastSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title is required').trim(),
    body: z.string().trim().optional()
  })
});
