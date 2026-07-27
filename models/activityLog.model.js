import mongoose from 'mongoose';
import { ACTIVITY_TYPE_VALUES } from '../constants/index.js';

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ACTIVITY_TYPE_VALUES, required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refModel: { type: String, default: null },
    dayKey: { type: String, required: true },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

activityLogSchema.index({ user: 1, dayKey: 1 });
activityLogSchema.index({ user: 1, type: 1, date: -1 });
activityLogSchema.index({ date: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
