import { Router } from 'express';
import auth from '../middlewares/auth.js';
import validateRequest from '../middlewares/validateRequest.js';
import rateLimiter, { emailKeyGenerator } from '../middlewares/rateLimiter.js';
import * as authController from '../controllers/auth.controller.js';
import * as authValidation from '../validations/auth.validation.js';

const router = Router();

const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign in attempts. Please try again in 15 minutes'
});

const otpLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: emailKeyGenerator,
  message: 'Too many verification requests. Please try again in 15 minutes'
});

router.post('/register', otpLimiter, validateRequest(authValidation.registerSchema), authController.register);
router.post('/verify-email', validateRequest(authValidation.verifyEmailSchema), authController.verifyEmail);
router.post('/login', loginLimiter, validateRequest(authValidation.loginSchema), authController.login);
router.post('/refresh-token', validateRequest(authValidation.refreshTokenSchema), authController.refreshToken);
router.post('/logout', auth(), validateRequest(authValidation.logoutSchema), authController.logout);
router.post('/logout-all', auth(), authController.logoutAll);
router.post(
  '/forgot-password',
  otpLimiter,
  validateRequest(authValidation.forgotPasswordSchema),
  authController.forgotPassword
);
router.post('/resend-otp', otpLimiter, validateRequest(authValidation.resendOtpSchema), authController.resendOtp);
router.post('/verify-otp', validateRequest(authValidation.verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', validateRequest(authValidation.resetPasswordSchema), authController.resetPassword);
router.patch(
  '/change-password',
  auth(),
  validateRequest(authValidation.changePasswordSchema),
  authController.changePassword
);

export default router;
