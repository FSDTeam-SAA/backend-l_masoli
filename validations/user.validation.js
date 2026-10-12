import { z } from 'zod';
import { paginationQuery } from './common.validation.js';
import {
  BILLING_PERIOD_VALUES,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_VALUES,
  SUBSCRIPTION_TIER,
  SUBSCRIPTION_TIER_VALUES
} from '../constants/index.js';

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

// PATCH /users/me/subscription. The backend owns all subscription dates; the
// optional status keeps the original Premium activation payload compatible
// by resolving omitted Premium statuses to `active`.
export const updateSubscriptionSchema = z.object({
  body: z
    .object({
      tier: z.enum(SUBSCRIPTION_TIER_VALUES),
      billingPeriod: z.enum(BILLING_PERIOD_VALUES).optional(),
      status: z.enum(SUBSCRIPTION_STATUS_VALUES).optional()
    })
    .superRefine((data, ctx) => {
      const status =
        data.status ||
        (data.tier === SUBSCRIPTION_TIER.PREMIUM
          ? SUBSCRIPTION_STATUS.ACTIVE
          : SUBSCRIPTION_STATUS.NONE);

      const validTier =
        (status === SUBSCRIPTION_STATUS.NONE && data.tier === SUBSCRIPTION_TIER.FREE) ||
        (status !== SUBSCRIPTION_STATUS.NONE && data.tier === SUBSCRIPTION_TIER.PREMIUM);

      if (!validTier) {
        ctx.addIssue({
          code: 'custom',
          message: 'status none requires tier free; trialing or active requires tier premium',
          path: ['status']
        });
      }

      if (data.tier === SUBSCRIPTION_TIER.PREMIUM && data.billingPeriod === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'billingPeriod is required when tier is premium',
          path: ['billingPeriod']
        });
      }

      if (data.tier === SUBSCRIPTION_TIER.FREE && data.billingPeriod !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'billingPeriod is only allowed when tier is premium',
          path: ['billingPeriod']
        });
      }
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
