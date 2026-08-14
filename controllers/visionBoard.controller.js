import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import VisionBoard from '../models/visionBoard.model.js';
import Dream from '../models/dream.model.js';
import Goal from '../models/goal.model.js';
import CoverMood from '../models/coverMood.model.js';
import { ACTIVITY_TYPE, CLOUDINARY_FOLDERS } from '../constants/index.js';
import {
  uploadManyToCloudinary,
  uploadToCloudinary,
  deleteManyFromCloudinary,
  toImagePayload
} from '../utils/cloudinary.js';
import { logActivity } from '../services/activity.service.js';
import { evaluateBadges } from '../services/badge.service.js';
import { recomputeBoardProgress } from '../services/dreamProgress.service.js';
import { assertWithinLimit } from '../services/plan.service.js';
import { formatDateLabel, relativeUpdatedLabel } from '../utils/labelHelper.js';
import { groupDreamUploads } from '../utils/dreamUploads.js';
import { decorateDream, dreamImages, findOwnedBoard } from './dream.controller.js';

const BOARD_DETAIL_DREAM_LIMIT = 9;

const decorateBoard = (board, timezone) => {
  const plain = typeof board.toObject === 'function' ? board.toObject() : board;

  return {
    ...plain,
    updatedLabel: relativeUpdatedLabel(plain.lastUpdatedAt),
    updatedDateLabel: formatDateLabel(plain.lastUpdatedAt, timezone)
  };
};

const resolveCoverImage = async ({ coverMoodId, file }) => {
  if (file) {
    const result = await uploadToCloudinary(file.buffer, CLOUDINARY_FOLDERS.BOARDS);
    const image = toImagePayload(result);
    return { coverMood: null, coverImage: { url: image.url, publicId: image.publicId } };
  }

  if (coverMoodId) {
    const coverMood = await CoverMood.findOne({ _id: coverMoodId, isActive: true });

    if (!coverMood) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Selected cover mood is not available');
    }

    return {
      coverMood: coverMood._id,
      coverImage: { url: coverMood.image.url, publicId: '' }
    };
  }

  return null;
};

export const listBoards = catchAsync(async (req, res) => {
  const builder = new QueryBuilder(VisionBoard.find({ user: req.user._id, isDeleted: false }), req.query)
    .search(['name'])
    .sort('-lastUpdatedAt')
    .paginate();

  const [boards, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  sendResponse(res, {
    message: 'Dream boards retrieved successfully',
    meta,
    data: {
      summary: {
        total: meta.total,
        headline: `${meta.total} board${meta.total === 1 ? '' : 's'} keeping you inspired`
      },
      boards: boards.map((board) => decorateBoard(board, req.user.timezone))
    }
  });
});

export const createBoard = catchAsync(async (req, res) => {
  await assertWithinLimit('boards', { user: req.user });

  const files = Array.isArray(req.files) ? req.files : [];
  const coverFile = files.find((file) => file.fieldname === 'cover') || null;
  const dreamGroups = groupDreamUploads(req);

  const cover = await resolveCoverImage({ coverMoodId: req.body.coverMood, file: coverFile });

  const board = await VisionBoard.create({
    user: req.user._id,
    name: req.body.name,
    collageLayout: req.body.collageLayout || 'grid-2',
    ...(cover || {})
  });

  if (dreamGroups.length > 0) {
    // One staged dream per group - each keeps all of its own images, with
    // the first as that dream's cover.
    const uploaded = await Promise.all(
      dreamGroups.map((group) => uploadManyToCloudinary(group.files, CLOUDINARY_FOLDERS.DREAMS))
    );

    const dreams = await Dream.insertMany(
      dreamGroups.map((group, index) => ({
        user: req.user._id,
        board: board._id,
        title: group.title,
        story: group.story,
        images: uploaded[index].map(toImagePayload),
        order: index
      }))
    );

    const dreamCover = dreams.map((dream) => dream.images[0]).find((image) => image?.url);

    if (!board.coverImage?.url && dreamCover) {
      board.coverImage = { url: dreamCover.url, publicId: dreamCover.publicId };
      await board.save();
    }

    await logActivity({
      user: req.user,
      type: ACTIVITY_TYPE.DREAM_CREATED,
      refId: board._id,
      refModel: 'VisionBoard'
    });
  }

  await recomputeBoardProgress(board._id);

  await logActivity({
    user: req.user,
    type: ACTIVITY_TYPE.BOARD_CREATED,
    refId: board._id,
    refModel: 'VisionBoard'
  });

  await evaluateBadges(req.user._id);

  const fresh = await VisionBoard.findById(board._id);
  const dreams = await Dream.find({ board: board._id, isDeleted: false }).sort({ order: 1 });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Dream board created successfully',
    data: {
      ...decorateBoard(fresh, req.user.timezone),
      dreams: dreams.map((dream) => decorateDream(dream, req.user.timezone))
    }
  });
});

export const getBoard = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  await board.populate({ path: 'coverMood', select: 'title image' });

  const dreams = await Dream.find({ board: board._id, isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .limit(BOARD_DETAIL_DREAM_LIMIT);

  sendResponse(res, {
    message: 'Dream board retrieved successfully',
    data: {
      ...decorateBoard(board, req.user.timezone),
      dreams: dreams.map((dream) => decorateDream(dream, req.user.timezone)),
      remainingDreamCount: Math.max(board.dreamCount - dreams.length, 0)
    }
  });
});

export const updateBoard = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  const payload = pick(req.body, ['name', 'collageLayout']);

  if (req.body.coverMood) {
    const cover = await resolveCoverImage({ coverMoodId: req.body.coverMood });
    Object.assign(payload, cover);
  }

  Object.assign(board, payload);
  board.lastUpdatedAt = new Date();
  await board.save();

  sendResponse(res, {
    message: 'Dream board updated successfully',
    data: decorateBoard(board, req.user.timezone)
  });
});

export const deleteBoard = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  const dreams = await Dream.find({ board: board._id }).select('_id images image');

  board.isDeleted = true;
  await board.save();

  await Dream.updateMany({ board: board._id }, { isDeleted: true });
  await Goal.updateMany({ dream: { $in: dreams.map((dream) => dream._id) } }, { dream: null });

  await deleteManyFromCloudinary([
    ...dreams.flatMap((dream) => dreamImages(dream).map((image) => image.publicId)),
    board.coverImage?.publicId
  ]);

  sendResponse(res, { message: 'Dream board deleted successfully' });
});

export const updateCollageLayout = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  board.collageLayout = req.body.collageLayout;
  board.lastUpdatedAt = new Date();
  await board.save();

  sendResponse(res, {
    message: 'Collage layout updated successfully',
    data: decorateBoard(board, req.user.timezone)
  });
});
