import mongoose from 'mongoose';

// Durable deduplication across restarts and multiple application processes.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  userIds: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null }
}, { versionKey: false });

export default mongoose.model('RevenueCatEvent', schema);
