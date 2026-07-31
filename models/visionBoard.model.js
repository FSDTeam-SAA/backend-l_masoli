import mongoose from 'mongoose';
import { COLLAGE_LAYOUT_KEYS } from '../constants/index.js';

const visionBoardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    coverMood: { type: mongoose.Schema.Types.ObjectId, ref: 'CoverMood', default: null },
    coverImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }
    },
    collageLayout: { type: String, enum: COLLAGE_LAYOUT_KEYS, default: 'grid-2' },
    dreamCount: { type: Number, default: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    lastUpdatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

visionBoardSchema.index({ user: 1, isDeleted: 1, lastUpdatedAt: -1 });

const VisionBoard = mongoose.model('VisionBoard', visionBoardSchema);

export default VisionBoard;
