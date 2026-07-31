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
import { uploadManyToCloudinary, uploadToCloudinary, deleteFromCloudinary, toImagePayload } from '../utils/cloudinary.js';
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

export const decorateDream = (dream, timezone) => {
  const plain = typeof dream.toObject === 'function' ? dream.toObject() : dream;

  return {
    ...plain,
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

  if (!req.file && !req.body.title) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A dream needs a title, an image, or both');
  }

  await assertAreaAvailable(req.body.areaOfLife, req.user._id);

  let image = { url: '', publicId: '', width: 0, height: 0 };

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, CLOUDINARY_FOLDERS.DREAMS);
    image = toImagePayload(result);
  }

  const dream = await Dream.create({
    user: req.user._id,
    board: board._id,
    title: req.body.title || '',
    story: req.body.story || '',
    areaOfLife: req.body.areaOfLife || null,
    image,
    order: req.body.order ?? board.dreamCount
  });

  await dream.populate(POPULATE_AREA);

  if (!board.coverImage?.url && image.url) {
    board.coverImage = { url: image.url, publicId: image.publicId };
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

export const createManyDreams = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  const files = req.files?.length ? req.files : [];

  if (files.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please upload at least one image');
  }

  for (let index = 0; index < files.length; index += 1) {
    await assertWithinLimit('dreamsPerBoard', { user: req.user, scopeId: board._id });
  }

  const results = await uploadManyToCloudinary(files, CLOUDINARY_FOLDERS.DREAMS);
  const titles = Array.isArray(req.body.title) ? req.body.title : req.body.title ? [req.body.title] : [];

  const dreams = await Dream.insertMany(
    results.map((result, index) => {
      const image = toImagePayload(result);
      return {
        user: req.user._id,
        board: board._id,
        title: titles[index] || '',
        story: '',
        image,
        order: board.dreamCount + index
      };
    })
  );

  if (!board.coverImage?.url) {
    board.coverImage = { url: dreams[0].image.url, publicId: dreams[0].image.publicId };
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

  const goals = await Goal.find({ dream: dream._id, isDeleted: false })
    .populate({ path: 'areaOfLife', select: 'name slug color icon' })
    .populate({ path: 'priority', select: 'name slug color weight' })
    .sort({ createdAt: -1 });

  sendResponse(res, {
    message: 'Dream retrieved successfully',
    data: {
      ...decorateDream(dream, req.user.timezone),
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

  if (req.file) {
    const previousPublicId = dream.image?.publicId;
    const result = await uploadToCloudinary(req.file.buffer, CLOUDINARY_FOLDERS.DREAMS);
    dream.image = toImagePayload(result);

    if (previousPublicId) {
      await deleteFromCloudinary(previousPublicId);
    }
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

  if (dream.image?.publicId) {
    await deleteFromCloudinary(dream.image.publicId);
  }

  const board = await VisionBoard.findById(dream.board);

  if (board && board.coverImage?.publicId === dream.image?.publicId) {
    const fallback = await Dream.findOne({ board: board._id, isDeleted: false }).sort({ order: 1 });
    board.coverImage = fallback?.image?.url
      ? { url: fallback.image.url, publicId: fallback.image.publicId }
      : { url: '', publicId: '' };
    await board.save();
  }

  await recomputeBoardProgress(dream.board);

  sendResponse(res, { message: 'Dream deleted successfully' });
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
