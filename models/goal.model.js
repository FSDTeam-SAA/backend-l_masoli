import mongoose from 'mongoose';
import { GOAL_STATUS, GOAL_STATUS_VALUES } from '../constants/index.js';

const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dream: { type: mongoose.Schema.Types.ObjectId, ref: 'Dream', default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    areaOfLife: { type: mongoose.Schema.Types.ObjectId, ref: 'AreaOfLife', required: true },
    priority: { type: mongoose.Schema.Types.ObjectId, ref: 'Priority', required: true },
    targetDate: { type: Date, required: true },
    status: { type: String, enum: GOAL_STATUS_VALUES, default: GOAL_STATUS.ACTIVE },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    totalMilestones: { type: Number, default: 0 },
    completedMilestones: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    isManuallyCompleted: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

goalSchema.index({ user: 1, isDeleted: 1, status: 1, createdAt: -1 });
goalSchema.index({ user: 1, areaOfLife: 1, isDeleted: 1 });
goalSchema.index({ dream: 1, isDeleted: 1 });
goalSchema.index({ user: 1, targetDate: 1 });
goalSchema.index({ status: 1, targetDate: 1, isDeleted: 1 });

const Goal = mongoose.model('Goal', goalSchema);

export default Goal;
