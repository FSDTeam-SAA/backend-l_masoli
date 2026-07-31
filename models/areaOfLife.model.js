import mongoose from 'mongoose';

const areaOfLifeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    icon: { type: String, default: 'target' },
    color: { type: String, default: '#3B82F6' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

areaOfLifeSchema.index({ slug: 1, user: 1 }, { unique: true });
areaOfLifeSchema.index({ user: 1, isActive: 1, order: 1 });

areaOfLifeSchema.virtual('isCustom').get(function () {
  return Boolean(this.user);
});

const AreaOfLife = mongoose.model('AreaOfLife', areaOfLifeSchema);

export default AreaOfLife;
