import mongoose from 'mongoose';

const progressSnapshotSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayKey: { type: String, required: true },
    overallPercent: { type: Number, default: 0 },
    completedGoals: { type: Number, default: 0 },
    completedMilestones: { type: Number, default: 0 },
    totalMilestones: { type: Number, default: 0 }
  },
  { timestamps: true }
);

progressSnapshotSchema.index({ user: 1, dayKey: 1 }, { unique: true });

const ProgressSnapshot = mongoose.model('ProgressSnapshot', progressSnapshotSchema);

export default ProgressSnapshot;
