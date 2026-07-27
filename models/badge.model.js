import mongoose from 'mongoose';
import { BADGE_METRIC_VALUES } from '../constants/index.js';

const badgeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'trophy' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    criteria: {
      metric: { type: String, enum: BADGE_METRIC_VALUES, required: true },
      threshold: { type: Number, required: true, min: 1 }
    }
  },
  { timestamps: true }
);

badgeSchema.index({ isActive: 1, order: 1 });

const Badge = mongoose.model('Badge', badgeSchema);

export default Badge;
