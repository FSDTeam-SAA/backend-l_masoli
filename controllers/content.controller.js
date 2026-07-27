import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import Priority from '../models/priority.model.js';
import CoverMood from '../models/coverMood.model.js';
import MotivationQuote from '../models/motivationQuote.model.js';
import StaticPage from '../models/staticPage.model.js';
import { COLLAGE_LAYOUTS } from '../constants/index.js';

export const getAreas = catchAsync(async (req, res) => {
  const areas = await AreaOfLife.find({ isActive: true }).sort({ order: 1, name: 1 });

  sendResponse(res, {
    message: 'Areas of life retrieved successfully',
    data: areas
  });
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
