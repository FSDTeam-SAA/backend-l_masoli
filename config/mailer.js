import nodemailer from 'nodemailer';
import env from './env.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER) {
    console.warn('SMTP is not configured. Emails will be logged to the console instead of sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  return transporter;
};

export default getTransporter;
