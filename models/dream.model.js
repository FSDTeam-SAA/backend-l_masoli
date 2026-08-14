import mongoose from 'mongoose';

const dreamImageSchema = new mongoose.Schema({
  url: { type: String, default: '' },
  publicId: { type: String, default: '' },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 }
});

const dreamSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'VisionBoard', required: true, index: true },
    title: { type: String, trim: true, default: '' },
    story: { type: String, trim: true, default: '' },
    areaOfLife: { type: mongoose.Schema.Types.ObjectId, ref: 'AreaOfLife', default: null },
    // One dream = one title + one story + many images. images[0] is always
    // the cover (the frame the board grid shows); changing the cover means
    // moving that image to the front of the array - there is no separate
    // cover flag to keep in sync.
    images: { type: [dreamImageSchema], default: [] },
    order: { type: Number, default: 0 },
    totalGoals: { type: Number, default: 0 },
    completedGoals: { type: Number, default: 0 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

dreamSchema.index({ board: 1, isDeleted: 1, order: 1, createdAt: -1 });
dreamSchema.index({ user: 1, isDeleted: 1 });

dreamSchema.virtual('displayTitle').get(function () {
  return this.title || 'Untitled dream';
});

dreamSchema.virtual('coverImage').get(function () {
  return this.images?.[0] || null;
});

const Dream = mongoose.model('Dream', dreamSchema);

export default Dream;
