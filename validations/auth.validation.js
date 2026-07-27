import { z } from 'zod';
import { email, otpCode, password, matchPasswords } from './common.validation.js';
import { OTP_TYPE_VALUES } from '../constants/index.js';

export const registerSchema = z.object({
  body: z
    .object({
      userName: z.string().min(2, 'Name must be at least 2 characters').trim().optional(),
      firstName: z.string().trim().optional(),
      lastName: z.string().trim().optional(),
      email,
      phone: z.string().trim().optional(),
      password,
      confirmPassword: z.string(),
      timezone: z.string().optional()
    })
    .superRefine((data, ctx) => {
      if (!data.userName && !data.firstName) {
        ctx.addIssue({ code: 'custom', path: ['userName'], message: 'Name is required' });
      }
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
      }
    })
});

export const verifyEmailSchema = z.object({
  body: z.object({ email, otp: otpCode })
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, 'Password is required'),
    deviceToken: z.string().optional(),
    platform: z.enum(['android', 'ios', 'web']).optional(),
    timezone: z.string().optional()
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({ refreshToken: z.string().min(1, 'Refresh token is required') })
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
    deviceToken: z.string().optional()
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email })
});

export const resendOtpSchema = z.object({
  body: z.object({ email, type: z.enum(OTP_TYPE_VALUES) })
});

export const verifyOtpSchema = z.object({
  body: z.object({ email, otp: otpCode, type: z.enum(OTP_TYPE_VALUES) })
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      resetToken: z.string().min(1, 'Reset token is required'),
      newPassword: password,
      confirmPassword: z.string()
    })
    .superRefine(matchPasswords)
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: password,
      confirmPassword: z.string()
    })
    .superRefine(matchPasswords)
});
