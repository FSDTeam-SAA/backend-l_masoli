import nodemailer from 'nodemailer';
import env from './env.js';

let transporter = null;

export const isSingleMailbox = (value) => {
  if (typeof value !== 'string' || /[\r\n,;]/.test(value)) return false;
  const address = value.includes('<')
    ? value.match(/^[^<>]+<([^<>]+)>$/)?.[1]
    : value;
  return typeof address === 'string' && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address);
};

/** Messages contain field names and requirements, never configured values. */
export const mailConfigurationIssues = (settings = env) => {
  const issues = [];
  if (!settings.MAIL_HOST?.trim() || /[\s/@]/.test(settings.MAIL_HOST)) {
    issues.push('MAIL_HOST must be a non-empty SMTP hostname');
  }
  if (!Number.isInteger(settings.MAIL_PORT) || settings.MAIL_PORT < 1 || settings.MAIL_PORT > 65535) {
    issues.push('MAIL_PORT must be an integer from 1 to 65535');
  }
  if (typeof settings.MAIL_SECURE !== 'boolean') {
    issues.push('MAIL_SECURE must be true or false');
  }
  if (!settings.MAIL_USER?.trim() || /[\r\n]/.test(settings.MAIL_USER)) {
    issues.push('MAIL_USER is required');
  }
  if (!settings.MAIL_PASS?.trim()) issues.push('MAIL_PASS is required');
  if (!isSingleMailbox(settings.MAIL_FROM)) issues.push('MAIL_FROM must contain one valid sender address');
  if (!isSingleMailbox(settings.MAIL_REPLY_TO)) issues.push('MAIL_REPLY_TO must contain one valid reply address');
  return issues;
};

export const validateMailConfiguration = (settings = env) => {
  const issues = mailConfigurationIssues(settings);
  if (issues.length) {
    const error = new Error(`Mail configuration is incomplete or invalid: ${issues.join('; ')}. Configure the server MAIL_* environment variables before starting production.`);
    error.code = 'MAIL_CONFIGURATION';
    throw error;
  }
};

export const validateProductionMailConfiguration = (settings = env) => {
  if (settings.NODE_ENV === 'production') validateMailConfiguration(settings);
};

const getTransporter = () => {
  if (transporter) return transporter;

  const issues = mailConfigurationIssues();
  if (issues.length) {
    validateProductionMailConfiguration();
    console.warn(`[mail:console] SMTP is not configured; email will be logged locally. ${issues.join('; ')}.`);
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    // false means STARTTLS, not permission to send production credentials
    // over plaintext. Implicit TLS providers use MAIL_SECURE=true.
    requireTLS: env.NODE_ENV === 'production' && !env.MAIL_SECURE,
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASS
    }
  });

  return transporter;
};

export default getTransporter;
