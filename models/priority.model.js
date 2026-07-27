import mongoose from 'mongoose';

const prioritySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    color: { type: String, default: '#F59E0B' },
    weight: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

prioritySchema.index({ isActive: 1, order: 1 });

const Priority = mongoose.model('Priority', prioritySchema);

export default Priority;
