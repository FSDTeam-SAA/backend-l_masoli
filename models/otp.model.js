import mongoose from 'mongoose';
import { OTP_TYPE_VALUES } from '../constants/index.js';

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    type: { type: String, enum: OTP_TYPE_VALUES, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    resetJti: { type: String, default: null }
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, type: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model('Otp', otpSchema);

export default Otp;
