import mongoose from 'mongoose';
import { PAGE_SLUG_VALUES } from '../constants/index.js';

const staticPageSchema = new mongoose.Schema(
  {
    slug: { type: String, enum: PAGE_SLUG_VALUES, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

const StaticPage = mongoose.model('StaticPage', staticPageSchema);

export default StaticPage;
