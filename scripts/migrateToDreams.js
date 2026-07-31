import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Dream from '../models/dream.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import { recomputeBoardProgress } from '../services/dreamProgress.service.js';

const dropStaleIndexes = async () => {
  const collection = mongoose.connection.collection('areaoflives');
  const indexes = await collection.indexes();

  for (const index of indexes) {
    const isStaleSlug = index.name === 'slug_1' && index.unique;
    const isStaleName = index.name === 'name_1' && index.unique;

    if (isStaleSlug || isStaleName) {
      await collection.dropIndex(index.name);
      console.log(`  dropped stale unique index: ${index.name}`);
    }
  }
};

const backfillGlobalAreas = async () => {
  const result = await mongoose.connection
    .collection('areaoflives')
    .updateMany({ user: { $exists: false } }, { $set: { user: null } });

  console.log(`  areas marked global: ${result.modifiedCount}`);
};

const migrateBoardImages = async () => {
  const collections = await mongoose.connection.db.listCollections({ name: 'boardimages' }).toArray();

  if (collections.length === 0) {
    console.log('  no boardimages collection found - nothing to migrate');
    return 0;
  }

  const images = await mongoose.connection.collection('boardimages').find({ isDeleted: { $ne: true } }).toArray();

  if (images.length === 0) {
    console.log('  no board images to migrate');
    return 0;
  }

  let migrated = 0;

  for (const image of images) {
    const exists = await Dream.findOne({ board: image.board, 'image.publicId': image.publicId });
    if (exists) continue;

    await Dream.create({
      user: image.user,
      board: image.board,
      title: image.caption || '',
      story: '',
      image: {
        url: image.url,
        publicId: image.publicId,
        width: image.width || 0,
        height: image.height || 0
      },
      order: image.order || 0,
      createdAt: image.createdAt
    });

    migrated += 1;
  }

  return migrated;
};

const run = async () => {
  await connectDB();

  console.log('Migrating to the Dream structure...\n');

  console.log('Areas of life:');
  await dropStaleIndexes();
  await backfillGlobalAreas();

  console.log('\nBoard images -> Dreams:');
  const migrated = await migrateBoardImages();
  console.log(`  dreams created: ${migrated}`);

  console.log('\nRecomputing board counters:');
  const boards = await VisionBoard.find({ isDeleted: false }).select('_id');
  for (const board of boards) {
    await recomputeBoardProgress(board._id);
  }
  console.log(`  boards recomputed: ${boards.length}`);

  console.log('\nMigration complete.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
