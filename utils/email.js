import getTransporter from '../config/mailer.js';
import env from '../config/env.js';
import { otpTemplate, passwordChangedTemplate } from './emailTemplates.js';
import { buildWelcomeEmail } from '../templates/welcomeEmail.js';

export const sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  if (!transporter) {
    // Development/test fallback only; production validation never permits it.
    console.info('[mail:console]', {
      from: env.MAIL_FROM, replyTo: env.MAIL_REPLY_TO, to, subject,
      ...(html !== undefined && { html }),
      ...(text !== undefined && { text })
    });
    return false;
  }

  try {
    await transporter.sendMail({
      from: env.MAIL_FROM, replyTo: env.MAIL_REPLY_TO, to, subject, html,
      ...(text !== undefined && { text })
    });
    return true;
  } catch (error) {
    // SMTP responses/messages can echo authentication data. Log only known
    // codes, never raw errors, credentials, provider responses or email bodies.
    const safeCodes = new Set(['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ETLS',
      'EENVELOPE', 'EMESSAGE', 'EDNS', 'ECONNRESET', 'ECONNREFUSED']);
    console.error('[mail:failed] Email delivery failed.', {
      code: safeCodes.has(error.code) ? error.code : 'UNKNOWN',
      ...(Number.isInteger(error.responseCode) && error.responseCode >= 100 && error.responseCode <= 599
        ? { responseCode: error.responseCode } : {})
    });
    return false;
  }
};

export const sendOtpEmail = async ({ to, otp, purpose }) => {
  if (env.NODE_ENV !== 'production') {
    console.info(`[otp] ${purpose} code for ${to}: ${otp}`);
  }

  return sendMail({
    to,
    subject: purpose === 'password_reset' ? 'Reset your password' : 'Verify your email',
    html: otpTemplate({ otp, expiresInMinutes: env.OTP_EXPIRES_MINUTES, purpose })
  });
};

export const sendPasswordChangedEmail = async ({ to, userName }) =>
  sendMail({ to, subject: 'Your password was changed', html: passwordChangedTemplate({ userName }) });

export const sendWelcomeEmail = async ({ to }) => {
  try {
    return await sendMail({ to, ...buildWelcomeEmail() });
  } catch {
    // Rendering/configuration failures are non-fatal too. Verification and
    // the existing welcome trigger continue even if this email cannot render.
    console.error('[mail:failed] Unable to prepare or send welcome email.');
    return false;
  }
};
