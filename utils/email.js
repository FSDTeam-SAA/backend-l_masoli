import getTransporter from '../config/mailer.js';
import env from '../config/env.js';
import { otpTemplate, passwordChangedTemplate, welcomeTemplate } from './emailTemplates.js';

const send = async ({ to, subject, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.info(`[email:skipped] to=${to} subject="${subject}"`);
    return false;
  }

  try {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html });
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    return false;
  }
};

export const sendOtpEmail = async ({ to, otp, purpose }) => {
  if (env.NODE_ENV !== 'production') {
    console.info(`[otp] ${purpose} code for ${to}: ${otp}`);
  }

  return send({
    to,
    subject: purpose === 'password_reset' ? 'Reset your password' : 'Verify your email',
    html: otpTemplate({ otp, expiresInMinutes: env.OTP_EXPIRES_MINUTES, purpose })
  });
};

export const sendPasswordChangedEmail = async ({ to, userName }) =>
  send({ to, subject: 'Your password was changed', html: passwordChangedTemplate({ userName }) });

export const sendWelcomeEmail = async ({ to, userName }) =>
  send({ to, subject: 'Welcome to My Dream Board', html: welcomeTemplate({ userName }) });
