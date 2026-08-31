import { z } from 'zod';
import { paginationQuery } from './common.validation.js';
import { BILLING_PERIOD_VALUES, SUBSCRIPTION_TIER, SUBSCRIPTION_TIER_VALUES } from '../constants/index.js';

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

// PATCH /users/me/subscription. Only the target tier (and, for Premium, the
// billing period) is accepted — the backend owns source/startedAt/expiresAt
// so a client cannot grant itself an arbitrary expiry. When real billing
// lands, the receipt/token from the store gets validated here and `source`
// stops being 'manual'.
export const updateSubscriptionSchema = z.object({
  body: z
    .object({
      tier: z.enum(SUBSCRIPTION_TIER_VALUES),
      billingPeriod: z.enum(BILLING_PERIOD_VALUES).optional()
    })
    .refine((data) => data.tier !== SUBSCRIPTION_TIER.PREMIUM || data.billingPeriod !== undefined, {
      message: 'billingPeriod is required when tier is premium',
      path: ['billingPeriod']
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
