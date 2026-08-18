import 'dotenv/config';

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
};

const toList = (value, fallback) => {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: toNumber(process.env.PORT, 5000),
  DATABASE_URL: process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/my-dream-board',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  CORS_ORIGINS: toList(process.env.CORS_ORIGINS, []),

  BCRYPT_SALT_ROUNDS: toNumber(process.env.BCRYPT_SALT_ROUNDS, 12),

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'change-this-access-secret',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  JWT_RESET_SECRET: process.env.JWT_RESET_SECRET || 'change-this-reset-secret',
  JWT_RESET_EXPIRES_IN: process.env.JWT_RESET_EXPIRES_IN || '10m',

  OTP_EXPIRES_MINUTES: toNumber(process.env.OTP_EXPIRES_MINUTES, 5),
  OTP_RESEND_COOLDOWN_SECONDS: toNumber(process.env.OTP_RESEND_COOLDOWN_SECONDS, 45),
  OTP_MAX_ATTEMPTS: toNumber(process.env.OTP_MAX_ATTEMPTS, 5),
  OTP_MAX_RESENDS: toNumber(process.env.OTP_MAX_RESENDS, 5),

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: toNumber(process.env.SMTP_PORT, 587),
  SMTP_SECURE: toBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'My Dream Board <no-reply@mydreamboard.app>',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'my-dream-board',
  DEFAULT_AVATAR_URL: process.env.DEFAULT_AVATAR_URL || '',

  RATE_LIMIT_WINDOW_MS: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  RATE_LIMIT_MAX: toNumber(process.env.RATE_LIMIT_MAX, 300),

  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),

  ENABLE_CRON: toBoolean(process.env.ENABLE_CRON, true),
  ADMIN_TIMEZONE: process.env.ADMIN_TIMEZONE || 'UTC',
  ADMIN_USER_TARGET: toNumber(process.env.ADMIN_USER_TARGET, 100),

  SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME || 'Super Admin',
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || '',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || ''
});

export default env;
