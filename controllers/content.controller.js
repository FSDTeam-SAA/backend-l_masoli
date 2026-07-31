import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import Goal from '../models/goal.model.js';
import { assertWithinLimit } from '../services/plan.service.js';
import Priority from '../models/priority.model.js';
import CoverMood from '../models/coverMood.model.js';
import MotivationQuote from '../models/motivationQuote.model.js';
import StaticPage from '../models/staticPage.model.js';
import { COLLAGE_LAYOUTS } from '../constants/index.js';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const getAreas = catchAsync(async (req, res) => {
  const areas = await AreaOfLife.find({
    isActive: true,
    $or: [{ user: null }, { user: req.user._id }]
  }).sort({ user: 1, order: 1, name: 1 });

  sendResponse(res, {
    message: 'Areas of life retrieved successfully',
    data: areas
  });
});

export const createMyArea = catchAsync(async (req, res) => {
  await assertWithinLimit('customAreasOfLife', { user: req.user });

  const slug = slugify(req.body.name);

  const clash = await AreaOfLife.findOne({
    slug,
    $or: [{ user: null }, { user: req.user._id }]
  });

  if (clash) {
    throw new ApiError(StatusCodes.CONFLICT, `"${clash.name}" already exists in your areas of life`);
  }

  const area = await AreaOfLife.create({
    name: req.body.name,
    slug,
    icon: req.body.icon || 'target',
    color: req.body.color || '#3B82F6',
    order: req.body.order ?? 99,
    user: req.user._id,
    createdBy: req.user._id
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Area of life created successfully',
    data: area
  });
});

export const updateMyArea = catchAsync(async (req, res) => {
  const area = await AreaOfLife.findOne({ _id: req.params.id, user: req.user._id });

  if (!area) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'You can only edit areas of life that you created yourself'
    );
  }

  Object.assign(area, pick(req.body, ['name', 'icon', 'color', 'order', 'isActive']));

  if (req.body.name) {
    area.slug = slugify(req.body.name);
  }

  await area.save();

  sendResponse(res, { message: 'Area of life updated successfully', data: area });
});

export const deleteMyArea = catchAsync(async (req, res) => {
  const area = await AreaOfLife.findOne({ _id: req.params.id, user: req.user._id });

  if (!area) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'You can only delete areas of life that you created yourself'
    );
  }

  const inUse = await Goal.countDocuments({
    areaOfLife: area._id,
    user: req.user._id,
    isDeleted: false
  });

  if (inUse > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `"${area.name}" is used by ${inUse} of your goals. Move those goals to another area first`
    );
  }

  await area.deleteOne();

  sendResponse(res, { message: 'Area of life deleted successfully' });
});

export const getPriorities = catchAsync(async (req, res) => {
  const priorities = await Priority.find({ isActive: true }).sort({ order: 1, weight: -1 });

  sendResponse(res, {
    message: 'Priorities retrieved successfully',
    data: priorities
  });
});

export const getCoverMoods = catchAsync(async (req, res) => {
  const coverMoods = await CoverMood.find({ isActive: true }).sort({ order: 1, createdAt: -1 });

  sendResponse(res, {
    message: 'Cover moods retrieved successfully',
    data: coverMoods
  });
});

export const getCollageLayouts = catchAsync(async (req, res) => {
  sendResponse(res, {
    message: 'Collage layouts retrieved successfully',
    data: COLLAGE_LAYOUTS
  });
});

export const getRandomQuote = catchAsync(async (req, res) => {
  const exclude = req.query.exclude;
  const match = { isActive: true };

  if (exclude && /^[0-9a-fA-F]{24}$/.test(exclude)) {
    const [quote] = await MotivationQuote.aggregate([
      { $match: { ...match, _id: { $ne: new mongoose.Types.ObjectId(exclude) } } },
      { $sample: { size: 1 } }
    ]);

    if (quote) {
      return sendResponse(res, { message: 'Motivation retrieved successfully', data: quote });
    }
  }

  const [quote] = await MotivationQuote.aggregate([{ $match: match }, { $sample: { size: 1 } }]);

  sendResponse(res, {
    message: 'Motivation retrieved successfully',
    data: quote || null
  });
});

export const getPages = catchAsync(async (req, res) => {
  const pages = await StaticPage.find().select('slug title updatedAt').sort({ slug: 1 });

  sendResponse(res, {
    message: 'Pages retrieved successfully',
    data: pages
  });
});

export const getPageBySlug = catchAsync(async (req, res) => {
  const page = await StaticPage.findOne({ slug: req.params.slug });

  if (!page) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Page not found');
  }

  sendResponse(res, {
    message: 'Page retrieved successfully',
    data: page
  });
});
