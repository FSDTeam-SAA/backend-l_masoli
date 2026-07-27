import mongoose from 'mongoose';

const boardImageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'VisionBoard', required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    caption: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

boardImageSchema.index({ board: 1, isDeleted: 1, order: 1, createdAt: -1 });

const BoardImage = mongoose.model('BoardImage', boardImageSchema);

export default BoardImage;
