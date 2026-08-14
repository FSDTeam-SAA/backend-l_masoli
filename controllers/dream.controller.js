import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import Dream from '../models/dream.model.js';
import Goal from '../models/goal.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import { ACTIVITY_TYPE, CLOUDINARY_FOLDERS } from '../constants/index.js';
import {
  uploadManyToCloudinary,
  deleteFromCloudinary,
  deleteManyFromCloudinary,
  toImagePayload
} from '../utils/cloudinary.js';
import { assertImagesPerDream, collectDreamFiles, groupDreamUploads } from '../utils/dreamUploads.js';
import { logActivity } from '../services/activity.service.js';
import { evaluateBadges } from '../services/badge.service.js';
import { recomputeBoardProgress, recomputeDreamProgress } from '../services/dreamProgress.service.js';
import { assertWithinLimit } from '../services/plan.service.js';
import { formatDateLabel, relativeUpdatedLabel } from '../utils/labelHelper.js';
import { decorateGoal } from './goal.controller.js';

const POPULATE_AREA = { path: 'areaOfLife', select: 'name slug color icon' };

const assertAreaAvailable = async (areaOfLife, userId) => {
  if (!areaOfLife) return;

  const exists = await AreaOfLife.exists({
    _id: areaOfLife,
    isActive: true,
    $or: [{ user: null }, { user: userId }]
  });

  if (!exists) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Selected area of life is not available');
  }
};

const EMPTY_IMAGE = { url: '', publicId: '', width: 0, height: 0 };

/// Reads a dream's images off either shape: the current `images` array, or
/// the single `image` object dreams were stored with before one dream could
/// hold several. Documents written under the old shape keep rendering until
/// scripts/migrateDreamImages.js has run over them.
export const dreamImages = (dream) => {
  if (Array.isArray(dream.images) && dream.images.length > 0) return dream.images;

  // On a hydrated document the old field has no getter (it is off-schema
  // now), but Mongoose still keeps it in _doc - so read both.
  const legacy = dream.image || dream._doc?.image;

  return legacy?.url ? [legacy] : [];
};

/// The same images as plain objects, safe to reorder or splice and assign
/// straight back to `dream.images`. Each entry keeps its `_id`, so rewriting
/// the array does not hand the surviving images new ids.
const normalizeDreamImages = (dream) =>
  dreamImages(dream).map((image) =>
    typeof image.toObject === 'function' ? image.toObject() : { ...image }
  );

export const decorateDream = (dream, timezone) => {
  const plain = typeof dream.toObject === 'function' ? dream.toObject() : dream;
  // The pre-migration `image` field is dropped from the payload so clients
  // only ever see one shape: images[] plus the cover.
  const { image: legacyImage, ...rest } = plain;
  const images = dreamImages(plain);
  void legacyImage;

  return {
    ...rest,
    images,
    // images[0] is the cover by convention - sent explicitly so clients
    // never have to know that.
    coverImage: images[0] || EMPTY_IMAGE,
    imageCount: images.length,
    displayTitle: plain.title || 'Untitled dream',
    goalSummary: `${plain.completedGoals}/${plain.totalGoals} goals`,
    goalProgressLabel: `${plain.completedGoals} of ${plain.totalGoals} goals complete`,
    updatedLabel: relativeUpdatedLabel(plain.updatedAt),
    createdAtLabel: formatDateLabel(plain.createdAt, timezone)
  };
};

export const findOwnedBoard = async (boardId, userId) => {
  const board = await VisionBoard.findOne({ _id: boardId, user: userId, isDeleted: false });

  if (!board) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dream board not found');
  }

  return board;
};

/// The cover a board falls back to once the image it was showing is gone -
/// the cover of its first remaining dream that still has one, or nothing.
/// Dreams are walked rather than filtered in the query because a dream on the
/// pre-migration shape holds its image outside `images` (see dreamImages).
const nextBoardCover = async (boardId) => {
  const dreams = await Dream.find({ board: boardId, isDeleted: false }).sort({ order: 1 });

  for (const dream of dreams) {
    const cover = dreamImages(dream)[0];
    if (cover?.url) return cover;
  }

  return null;
};

const findOwnedDream = async (dreamId, userId) => {
  const dream = await Dream.findOne({ _id: dreamId, user: userId, isDeleted: false });

  if (!dream) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dream not found');
  }

  return dream;
};

export const listAllDreams = catchAsync(async (req, res) => {
  const filter = { user: req.user._id, isDeleted: false };

  if (req.query.board) filter.board = req.query.board;

  const builder = new QueryBuilder(
    Dream.find(filter)
      .populate({ path: 'board', select: 'name' })
      .populate(POPULATE_AREA),
    req.query
  )
    .search(['title', 'story'])
    .sort('board order')
    .paginate();

  const [dreams, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  sendResponse(res, {
    message: 'Dreams retrieved successfully',
    meta,
    data: dreams.map((dream) => ({
      ...decorateDream(dream, req.user.timezone),
      boardName: dream.board?.name || '',
      pickerCaption: `${dream.board?.name || 'Board'} - ${dream.progress}%`
    }))
  });
});

export const listDreams = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  const builder = new QueryBuilder(
    Dream.find({ board: board._id, isDeleted: false }).populate(POPULATE_AREA),
    req.query
  )
    .search(['title', 'story'])
    .sort('order')
    .paginate();

  const [dreams, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  sendResponse(res, {
    message: 'Dreams retrieved successfully',
    meta,
    data: dreams.map((dream) => decorateDream(dream, req.user.timezone))
  });
});

export const createDream = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  await assertWithinLimit('dreamsPerBoard', { user: req.user, scopeId: board._id });

  const files = collectDreamFiles(req);

  if (files.length === 0 && !req.body.title) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A dream needs a title, an image, or both');
  }

  assertImagesPerDream(files.length);
  await assertAreaAvailable(req.body.areaOfLife, req.user._id);

  // Every file on this request belongs to this one dream; the first is its
  // cover.
  const results = await uploadManyToCloudinary(files, CLOUDINARY_FOLDERS.DREAMS);
  const images = results.map(toImagePayload);

  const dream = await Dream.create({
    user: req.user._id,
    board: board._id,
    title: req.body.title || '',
    story: req.body.story || '',
    areaOfLife: req.body.areaOfLife || null,
    images,
    order: req.body.order ?? board.dreamCount
  });

  await dream.populate(POPULATE_AREA);

  const cover = images[0];

  if (!board.coverImage?.url && cover?.url) {
    board.coverImage = { url: cover.url, publicId: cover.publicId };
    await board.save();
  }

  await recomputeBoardProgress(board._id);

  await logActivity({
    user: req.user,
    type: ACTIVITY_TYPE.DREAM_CREATED,
    refId: dream._id,
    refModel: 'Dream'
  });

  await evaluateBadges(req.user._id);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Dream added successfully',
    data: decorateDream(dream, req.user.timezone)
  });
});

/// Creates several dreams in one request - each with its own title, story
/// and image set. See utils/dreamUploads.js for the multipart shape.
export const createManyDreams = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  const groups = groupDreamUploads(req);

  if (groups.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please add at least one dream');
  }

  for (let index = 0; index < groups.length; index += 1) {
    await assertWithinLimit('dreamsPerBoard', { user: req.user, scopeId: board._id });
  }

  const uploaded = await Promise.all(
    groups.map((group) => uploadManyToCloudinary(group.files, CLOUDINARY_FOLDERS.DREAMS))
  );

  const dreams = await Dream.insertMany(
    groups.map((group, index) => ({
      user: req.user._id,
      board: board._id,
      title: group.title,
      story: group.story,
      images: uploaded[index].map(toImagePayload),
      order: board.dreamCount + index
    }))
  );

  const cover = dreams.map((dream) => dream.images[0]).find((image) => image?.url);

  if (!board.coverImage?.url && cover) {
    board.coverImage = { url: cover.url, publicId: cover.publicId };
    await board.save();
  }

  await recomputeBoardProgress(board._id);

  await logActivity({
    user: req.user,
    type: ACTIVITY_TYPE.DREAM_CREATED,
    refId: board._id,
    refModel: 'VisionBoard'
  });

  await evaluateBadges(req.user._id);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: `${dreams.length} dream${dreams.length === 1 ? '' : 's'} added successfully`,
    data: dreams.map((dream) => decorateDream(dream, req.user.timezone))
  });
});

export const getDream = catchAsync(async (req, res) => {
  const dream = await findOwnedDream(req.params.dreamId, req.user._id);
  await dream.populate(POPULATE_AREA);

  const [goals, board] = await Promise.all([
    Goal.find({ dream: dream._id, isDeleted: false })
      .populate({ path: 'areaOfLife', select: 'name slug color icon' })
      .populate({ path: 'priority', select: 'name slug color weight' })
      .sort({ createdAt: -1 }),
    VisionBoard.findById(dream.board).select('collageLayout')
  ]);

  sendResponse(res, {
    message: 'Dream retrieved successfully',
    data: {
      ...decorateDream(dream, req.user.timezone),
      // The collage layout is the *board's* preference, not the dream's (see
      // visionBoard.model.js). It rides along here so a screen opened on one
      // dream can arrange that dream's images the way its board is arranged,
      // without a second request for the board.
      collageLayout: board?.collageLayout || 'grid-2',
      goals: goals.map((goal) => decorateGoal(goal, req.user.timezone))
    }
  });
});

export const updateDream = catchAsync(async (req, res) => {
  const dream = await findOwnedDream(req.params.dreamId, req.user._id);

  await assertAreaAvailable(req.body.areaOfLife, req.user._id);

  Object.assign(dream, pick(req.body, ['title', 'story', 'order']));

  if (Object.prototype.hasOwnProperty.call(req.body, 'areaOfLife')) {
    dream.areaOfLife = req.body.areaOfLife || null;
  }

  const files = collectDreamFiles(req);

  if (files.length > 0 && req.body.replaceCover) {
    // "Replace" on the Edit Dream screen swaps the frame the board grid
    // shows and nothing else, so only images[0] is touched here - the branch
    // below would drop every other image the dream holds.
    const [result] = await uploadManyToCloudinary(files.slice(0, 1), CLOUDINARY_FOLDERS.DREAMS);
    // Read through dreamImages() so a dream still on the pre-migration shape
    // gets its single image folded into images[] rather than shadowed by the
    // new cover.
    const images = normalizeDreamImages(dream);
    const previous = images.shift();

    images.unshift(toImagePayload(result));
    dream.images = images;

    await deleteFromCloudinary(previous?.publicId);
  } else if (files.length > 0) {
    // Uploading replaces the whole set, matching the single-image behaviour
    // this endpoint has always had.
    assertImagesPerDream(files.length);
    const previousPublicIds = dreamImages(dream).map((image) => image.publicId);
    const results = await uploadManyToCloudinary(files, CLOUDINARY_FOLDERS.DREAMS);
    dream.images = results.map(toImagePayload);

    await deleteManyFromCloudinary(previousPublicIds);
  } else if (req.body.coverIndex !== undefined) {
    // Promotes an existing image to cover by moving it to the front - the
    // only way the cover changes, since images[0] *is* the cover.
    const index = req.body.coverIndex;

    if (index < 0 || index >= dream.images.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'coverIndex is out of range');
    }

    const [cover] = dream.images.splice(index, 1);
    dream.images.unshift(cover);
  }

  await dream.save();
  await dream.populate(POPULATE_AREA);
  await recomputeBoardProgress(dream.board);

  sendResponse(res, {
    message: 'Dream updated successfully',
    data: decorateDream(dream, req.user.timezone)
  });
});

export const deleteDream = catchAsync(async (req, res) => {
  const dream = await findOwnedDream(req.params.dreamId, req.user._id);

  dream.isDeleted = true;
  await dream.save();

  await Goal.updateMany({ dream: dream._id }, { dream: null });

  const images = dreamImages(dream);
  const publicIds = images.map((image) => image.publicId).filter(Boolean);

  await deleteManyFromCloudinary(publicIds);

  const board = await VisionBoard.findById(dream.board);

  // The board's cover is a copy of some dream's cover image, so it only
  // needs rebuilding when one of the images just deleted was the one on it.
  if (board && board.coverImage?.publicId && publicIds.includes(board.coverImage.publicId)) {
    const fallbackCover = await nextBoardCover(board._id);
    board.coverImage = fallbackCover?.url
      ? { url: fallbackCover.url, publicId: fallbackCover.publicId }
      : { url: '', publicId: '' };
    await board.save();
  }

  await recomputeBoardProgress(dream.board);

  sendResponse(res, { message: 'Dream deleted successfully' });
});

/// Removes ONE image from a dream - the full-screen viewer's delete action.
/// images[0] *is* the cover, so deleting it simply promotes the next image;
/// there is no cover flag to repoint. Answers with the updated dream so the
/// client can repaint from the response instead of refetching.
export const deleteDreamImage = catchAsync(async (req, res) => {
  const dream = await findOwnedDream(req.params.dreamId, req.user._id);
  const { imageId } = req.params;
  const images = normalizeDreamImages(dream);

  // Matched on either identifier: images written before
  // scripts/migrateDreamImages.js ran have no `_id` of their own, and their
  // publicId is the only thing a client can name them by.
  const index = images.findIndex(
    (image) => (image._id && String(image._id) === imageId) || image.publicId === imageId
  );

  if (index === -1) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Image not found on this dream');
  }

  const [removed] = images.splice(index, 1);

  dream.images = images;
  await dream.save();
  await dream.populate(POPULATE_AREA);

  const publicId = removed?.publicId || '';

  if (publicId) await deleteFromCloudinary(publicId);

  const board = await VisionBoard.findById(dream.board);

  // The board's cover is a copy of some dream's image, so it only needs
  // rebuilding when the image just removed was the one it was showing.
  if (board && publicId && board.coverImage?.publicId === publicId) {
    // The dream is already saved, so this sees the image that has just been
    // promoted to its cover.
    const fallbackCover = await nextBoardCover(board._id);

    board.coverImage = fallbackCover?.url
      ? { url: fallbackCover.url, publicId: fallbackCover.publicId }
      : { url: '', publicId: '' };
    await board.save();
  }

  sendResponse(res, {
    message: 'Image removed successfully',
    data: decorateDream(dream, req.user.timezone)
  });
});

export const reorderDreams = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  const ids = req.body.items.map((item) => item.id);

  const owned = await Dream.countDocuments({ _id: { $in: ids }, board: board._id, isDeleted: false });

  if (owned !== ids.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more dreams could not be found');
  }

  await Dream.bulkWrite(
    req.body.items.map((item) => ({
      updateOne: { filter: { _id: item.id, board: board._id }, update: { order: item.order } }
    }))
  );

  board.lastUpdatedAt = new Date();
  await board.save();

  sendResponse(res, { message: 'Dreams reordered successfully' });
});

export const listDreamGoals = catchAsync(async (req, res) => {
  const dream = await findOwnedDream(req.params.dreamId, req.user._id);

  const goals = await Goal.find({ dream: dream._id, isDeleted: false })
    .populate({ path: 'areaOfLife', select: 'name slug color icon' })
    .populate({ path: 'priority', select: 'name slug color weight' })
    .sort({ createdAt: -1 });

  sendResponse(res, {
    message: 'Dream goals retrieved successfully',
    data: goals.map((goal) => decorateGoal(goal, req.user.timezone))
  });
});

export { recomputeDreamProgress };
