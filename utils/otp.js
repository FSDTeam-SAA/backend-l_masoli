import crypto from 'crypto';

export const generateOtp = (length = 6) => {
  const max = 10 ** length;
  return String(crypto.randomInt(0, max)).padStart(length, '0');
};

export const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

export const compareOtp = (plainOtp, otpHash) => {
  const candidate = Buffer.from(hashOtp(plainOtp));
  const stored = Buffer.from(String(otpHash));

  if (candidate.length !== stored.length) return false;

  return crypto.timingSafeEqual(candidate, stored);
};
