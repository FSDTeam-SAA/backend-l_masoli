import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/user.model.js';
import { rebuildStreak } from '../services/streak.service.js';
import { ROLES } from '../constants/index.js';

const run = async () => {
  await connectDB();

  const users = await User.find({ role: ROLES.USER, isDeleted: false });
  let repaired = 0;

  for (const user of users) {
    await rebuildStreak(user);
    repaired += 1;
  }

  console.log(`Rebuilt streaks for ${repaired} users`);

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Repair failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
