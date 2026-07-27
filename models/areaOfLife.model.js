import mongoose from 'mongoose';

const areaOfLifeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icon: { type: String, default: 'target' },
    color: { type: String, default: '#3B82F6' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

areaOfLifeSchema.index({ isActive: 1, order: 1 });

const AreaOfLife = mongoose.model('AreaOfLife', areaOfLifeSchema);

export default AreaOfLife;
