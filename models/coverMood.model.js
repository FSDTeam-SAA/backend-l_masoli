import mongoose from 'mongoose';

const coverMoodSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    image: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

coverMoodSchema.index({ isActive: 1, order: 1 });

const CoverMood = mongoose.model('CoverMood', coverMoodSchema);

export default CoverMood;
