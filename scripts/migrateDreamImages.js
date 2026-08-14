import mongoose from 'mongoose';
import connectDB from '../config/db.js';

/// Dreams used to hold a single `image` object; they now hold an `images`
/// array whose first entry is the cover. This lifts every old document into
/// the new shape and drops the dead field.
///
/// Run with: node scripts/migrateDreamImages.js
/// Safe to run more than once - documents already carrying `images` are
/// skipped by the filter.
const migrateDreamImages = async () => {
  const collection = mongoose.connection.collection('dreams');

  const withLegacyImage = await collection
    .find({ image: { $exists: true }, images: { $exists: false } })
    .toArray();

  if (withLegacyImage.length === 0) {
    console.log('  no dreams on the old single-image shape');
  }

  let migrated = 0;

  for (const dream of withLegacyImage) {
    const image = dream.image;
    const images = image?.url
      ? [
          {
            _id: new mongoose.Types.ObjectId(),
            url: image.url,
            publicId: image.publicId || '',
            width: image.width || 0,
            height: image.height || 0
          }
        ]
      : [];

    await collection.updateOne({ _id: dream._id }, { $set: { images }, $unset: { image: '' } });
    migrated += 1;
  }

  console.log(`  dreams migrated: ${migrated}`);

  // Anything that already had `images` but kept the old field around too.
  const cleaned = await collection.updateMany({ image: { $exists: true } }, { $unset: { image: '' } });
  console.log(`  stale image fields removed: ${cleaned.modifiedCount}`);
};

const run = async () => {
  await connectDB();

  console.log('Dream image -> images[] migration:');
  await migrateDreamImages();
  console.log('\nMigration complete.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
