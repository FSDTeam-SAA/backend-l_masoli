import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
    reminderSentAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

milestoneSchema.index({ goal: 1, isDeleted: 1, dueDate: 1 });
milestoneSchema.index({ user: 1, isCompleted: 1, dueDate: 1 });
milestoneSchema.index({ user: 1, completedAt: 1 });
milestoneSchema.index({ isCompleted: 1, dueDate: 1, isDeleted: 1 });

const Milestone = mongoose.model('Milestone', milestoneSchema);

export default Milestone;
