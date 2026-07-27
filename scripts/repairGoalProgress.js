import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Goal from '../models/goal.model.js';
import { recomputeGoalProgress } from '../services/goalProgress.service.js';

const run = async () => {
  await connectDB();

  const goals = await Goal.find({ isDeleted: false }).select('_id');
  let repaired = 0;

  for (const goal of goals) {
    const updated = await recomputeGoalProgress(goal._id, { silent: true });
    if (updated) repaired += 1;
  }

  console.log(`Recomputed progress for ${repaired} of ${goals.length} goals`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Repair failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
