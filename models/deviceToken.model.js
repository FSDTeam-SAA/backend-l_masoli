import mongoose from 'mongoose';
import { DEVICE_PLATFORM_VALUES } from '../constants/index.js';

const deviceTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: DEVICE_PLATFORM_VALUES, default: 'android' },
    lastUsedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

export default DeviceToken;
