import mongoose from 'mongoose';

const motivationQuoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

motivationQuoteSchema.index({ isActive: 1, createdAt: -1 });

const MotivationQuote = mongoose.model('MotivationQuote', motivationQuoteSchema);

export default MotivationQuote;
