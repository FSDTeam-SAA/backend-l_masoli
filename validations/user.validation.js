import { z } from 'zod';
import { paginationQuery } from './common.validation.js';

export const updateProfileSchema = z.object({
  body: z.object({
    userName: z.string().min(2).trim().optional(),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    bio: z.string().max(500).optional(),
    dateOfBirth: z.coerce.date().optional(),
    timezone: z.string().optional()
  })
});

export const notificationSettingsSchema = z.object({
  body: z.object({
    goalReminders: z.coerce.boolean().optional(),
    milestoneReminders: z.coerce.boolean().optional(),
    dailyInspiration: z.coerce.boolean().optional()
  })
});

export const deleteAccountSchema = z.object({
  body: z.object({ password: z.string().min(1, 'Password is required') })
});

export const listQuerySchema = z.object({ query: paginationQuery });

export const deviceTokenSchema = z.object({
  body: z.object({
    token: z.string().min(10, 'Device token is required'),
    platform: z.enum(['android', 'ios', 'web']).optional()
  })
});

export const removeDeviceTokenSchema = z.object({
  body: z.object({ token: z.string().min(1, 'Device token is required') })
});
