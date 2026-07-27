import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import seed from './seed.js';

const run = async () => {
  await connectDB();

  const result = await seed();

  console.log('Seed complete:');
  console.log(`  areas of life inserted : ${result.areas}`);
  console.log(`  priorities inserted    : ${result.priorities}`);
  console.log(`  badges inserted        : ${result.badges}`);
  console.log(`  static pages inserted  : ${result.pages}`);
  console.log(`  quotes inserted        : ${result.quotes}`);
  console.log(
    result.adminCreated
      ? `  super admin created    : ${env.SUPER_ADMIN_EMAIL} / ${env.SUPER_ADMIN_PASSWORD}`
      : '  super admin            : already exists'
  );

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
