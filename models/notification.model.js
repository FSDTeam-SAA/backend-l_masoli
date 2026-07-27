import mongoose from 'mongoose';
import {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_AUDIENCE_VALUES,
  NOTIFICATION_TYPE_VALUES
} from '../constants/index.js';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    type: { type: String, enum: NOTIFICATION_TYPE_VALUES, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    audience: { type: String, enum: NOTIFICATION_AUDIENCE_VALUES, default: NOTIFICATION_AUDIENCE.USER },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    sentPush: { type: Boolean, default: false },
    dedupeKey: { type: String, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, audience: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
