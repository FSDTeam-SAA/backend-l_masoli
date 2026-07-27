import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import VisionBoard from '../models/visionBoard.model.js';
import BoardImage from '../models/boardImage.model.js';
import CoverMood from '../models/coverMood.model.js';
import { ACTIVITY_TYPE, CLOUDINARY_FOLDERS } from '../constants/index.js';
import {
  uploadManyToCloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteManyFromCloudinary,
  toImagePayload
} from '../utils/cloudinary.js';
import { logActivity } from '../services/activity.service.js';
import { evaluateBadges } from '../services/badge.service.js';
import { formatDateLabel, relativeUpdatedLabel } from '../utils/labelHelper.js';

const BOARD_DETAIL_IMAGE_LIMIT = 9;

const decorateBoard = (board, timezone) => {
  const plain = typeof board.toObject === 'function' ? board.toObject() : board;

  return {
    ...plain,
    updatedLabel: relativeUpdatedLabel(plain.lastUpdatedAt),
    updatedDateLabel: formatDateLabel(plain.lastUpdatedAt, timezone)
  };
};

const findOwnedBoard = async (boardId, userId) => {
  const board = await VisionBoard.findOne({ _id: boardId, user: userId, isDeleted: false });

  if (!board) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Dream board not found');
  }

  return board;
};

const syncImageCount = async (board) => {
  board.imageCount = await BoardImage.countDocuments({ board: board._id, isDeleted: false });
  board.lastUpdatedAt = new Date();
  await board.save();

  return board;
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
  const builder = new QueryBuilder(
    VisionBoard.find({ user: req.user._id, isDeleted: false }),
    req.query
  )
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
  const files = req.files?.images || (Array.isArray(req.files) ? req.files : []);
  const coverFile = req.files?.cover?.[0] || null;

  const cover = await resolveCoverImage({ coverMoodId: req.body.coverMood, file: coverFile });

  const board = await VisionBoard.create({
    user: req.user._id,
    name: req.body.name,
    collageLayout: req.body.collageLayout || 'grid-2',
    ...(cover || {})
  });

  if (files.length > 0) {
    const results = await uploadManyToCloudinary(files, CLOUDINARY_FOLDERS.BOARDS);

    await BoardImage.insertMany(
      results.map((result, index) => {
        const image = toImagePayload(result);
        return {
          user: req.user._id,
          board: board._id,
          url: image.url,
          publicId: image.publicId,
          width: image.width,
          height: image.height,
          order: index
        };
      })
    );

    if (!board.coverImage?.url) {
      const first = toImagePayload(results[0]);
      board.coverImage = { url: first.url, publicId: first.publicId };
    }
  }

  await syncImageCount(board);

  await logActivity({
    user: req.user,
    type: ACTIVITY_TYPE.BOARD_CREATED,
    refId: board._id,
    refModel: 'VisionBoard'
  });

  if (files.length > 0) {
    await logActivity({
      user: req.user,
      type: ACTIVITY_TYPE.IMAGE_UPLOADED,
      refId: board._id,
      refModel: 'VisionBoard'
    });
  }

  await evaluateBadges(req.user._id);

  const images = await BoardImage.find({ board: board._id, isDeleted: false }).sort({ order: 1 });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Dream board created successfully',
    data: { ...decorateBoard(board, req.user.timezone), images }
  });
});

export const getBoard = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  await board.populate({ path: 'coverMood', select: 'title image' });

  const images = await BoardImage.find({ board: board._id, isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .limit(BOARD_DETAIL_IMAGE_LIMIT);

  sendResponse(res, {
    message: 'Dream board retrieved successfully',
    data: {
      ...decorateBoard(board, req.user.timezone),
      images,
      remainingImageCount: Math.max(board.imageCount - images.length, 0)
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

  const images = await BoardImage.find({ board: board._id }).select('publicId');

  board.isDeleted = true;
  await board.save();
  await BoardImage.updateMany({ board: board._id }, { isDeleted: true });

  await deleteManyFromCloudinary([
    ...images.map((image) => image.publicId),
    board.coverImage?.publicId
  ]);

  sendResponse(res, { message: 'Dream board deleted successfully' });
});

export const listBoardImages = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  const builder = new QueryBuilder(BoardImage.find({ board: board._id, isDeleted: false }), req.query)
    .sort('order')
    .paginate();

  const [images, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  sendResponse(res, {
    message: 'Board images retrieved successfully',
    meta,
    data: images
  });
});

export const getBoardImage = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  const image = await BoardImage.findOne({ _id: req.params.imageId, board: board._id, isDeleted: false });

  if (!image) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Image not found');
  }

  sendResponse(res, { message: 'Image retrieved successfully', data: image });
});

export const addBoardImages = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  const files = req.files?.length ? req.files : [];

  if (files.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please upload at least one image');
  }

  const results = await uploadManyToCloudinary(files, CLOUDINARY_FOLDERS.BOARDS);

  const images = await BoardImage.insertMany(
    results.map((result, index) => {
      const image = toImagePayload(result);
      return {
        user: req.user._id,
        board: board._id,
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        order: board.imageCount + index
      };
    })
  );

  if (!board.coverImage?.url) {
    board.coverImage = { url: images[0].url, publicId: images[0].publicId };
  }

  await syncImageCount(board);

  await logActivity({
    user: req.user,
    type: ACTIVITY_TYPE.IMAGE_UPLOADED,
    refId: board._id,
    refModel: 'VisionBoard'
  });

  await evaluateBadges(req.user._id);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: `${images.length} image${images.length === 1 ? '' : 's'} added successfully`,
    data: { board: decorateBoard(board, req.user.timezone), images }
  });
});

export const deleteBoardImage = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);

  const image = await BoardImage.findOne({ _id: req.params.imageId, board: board._id, isDeleted: false });

  if (!image) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Image not found');
  }

  image.isDeleted = true;
  await image.save();
  await deleteFromCloudinary(image.publicId);

  if (board.coverImage?.publicId === image.publicId) {
    const fallback = await BoardImage.findOne({ board: board._id, isDeleted: false }).sort({ order: 1 });
    board.coverImage = fallback
      ? { url: fallback.url, publicId: fallback.publicId }
      : { url: '', publicId: '' };
  }

  await syncImageCount(board);

  sendResponse(res, {
    message: 'Image deleted successfully',
    data: decorateBoard(board, req.user.timezone)
  });
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

export const reorderBoardImages = catchAsync(async (req, res) => {
  const board = await findOwnedBoard(req.params.id, req.user._id);
  const ids = req.body.items.map((item) => item.id);

  const owned = await BoardImage.countDocuments({ _id: { $in: ids }, board: board._id, isDeleted: false });

  if (owned !== ids.length) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more images could not be found');
  }

  await BoardImage.bulkWrite(
    req.body.items.map((item) => ({
      updateOne: { filter: { _id: item.id, board: board._id }, update: { order: item.order } }
    }))
  );

  board.lastUpdatedAt = new Date();
  await board.save();

  sendResponse(res, { message: 'Images reordered successfully' });
});
