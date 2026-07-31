import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import pick from '../utils/pick.js';
import AreaOfLife from '../models/areaOfLife.model.js';
import Priority from '../models/priority.model.js';
import MotivationQuote from '../models/motivationQuote.model.js';
import CoverMood from '../models/coverMood.model.js';
import StaticPage from '../models/staticPage.model.js';
import Goal from '../models/goal.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import { uploadManyToCloudinary, deleteFromCloudinary, toImagePayload } from '../utils/cloudinary.js';
import { CLOUDINARY_FOLDERS } from '../constants/index.js';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const assertDeletable = async ({ document, Model, referenceField, label }) => {
  if (!document) {
    throw new ApiError(StatusCodes.NOT_FOUND, `${label} not found`);
  }

  if (document.isDefault) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `"${document.name}" is a default ${label.toLowerCase()} and cannot be deleted. Deactivate it instead`
    );
  }

  const inUse = await Model.countDocuments({ [referenceField]: document._id, isDeleted: false });

  if (inUse > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `"${document.name}" is used by ${inUse} goal${inUse === 1 ? '' : 's'}. Deactivate it instead of deleting`
    );
  }
};

export const listAreas = catchAsync(async (req, res) => {
  const areas = await AreaOfLife.find({ user: null }).sort({ order: 1, name: 1 });

  sendResponse(res, { message: 'Areas of life retrieved successfully', data: areas });
});

export const createArea = catchAsync(async (req, res) => {
  const area = await AreaOfLife.create({
    ...pick(req.body, ['name', 'icon', 'color', 'order']),
    slug: slugify(req.body.name),
    user: null,
    createdBy: req.user._id
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Area of life created successfully',
    data: area
  });
});

export const updateArea = catchAsync(async (req, res) => {
  const payload = pick(req.body, ['name', 'icon', 'color', 'order', 'isActive']);

  if (payload.name) payload.slug = slugify(payload.name);

  const area = await AreaOfLife.findOneAndUpdate({ _id: req.params.id, user: null }, payload, {
    new: true,
    runValidators: true
  });

  if (!area) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Area of life not found');
  }

  sendResponse(res, { message: 'Area of life updated successfully', data: area });
});

export const deleteArea = catchAsync(async (req, res) => {
  const area = await AreaOfLife.findOne({ _id: req.params.id, user: null });

  await assertDeletable({ document: area, Model: Goal, referenceField: 'areaOfLife', label: 'Area of life' });
  await area.deleteOne();

  sendResponse(res, { message: 'Area of life deleted successfully' });
});

export const listPriorities = catchAsync(async (req, res) => {
  const priorities = await Priority.find().sort({ order: 1, weight: -1 });

  sendResponse(res, { message: 'Priorities retrieved successfully', data: priorities });
});

export const createPriority = catchAsync(async (req, res) => {
  const priority = await Priority.create({
    ...pick(req.body, ['name', 'color', 'weight', 'order']),
    slug: slugify(req.body.name),
    createdBy: req.user._id
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Priority created successfully',
    data: priority
  });
});

export const updatePriority = catchAsync(async (req, res) => {
  const payload = pick(req.body, ['name', 'color', 'weight', 'order', 'isActive']);

  if (payload.name) payload.slug = slugify(payload.name);

  const priority = await Priority.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });

  if (!priority) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Priority not found');
  }

  sendResponse(res, { message: 'Priority updated successfully', data: priority });
});

export const deletePriority = catchAsync(async (req, res) => {
  const priority = await Priority.findById(req.params.id);

  await assertDeletable({ document: priority, Model: Goal, referenceField: 'priority', label: 'Priority' });
  await priority.deleteOne();

  sendResponse(res, { message: 'Priority deleted successfully' });
});

export const listQuotes = catchAsync(async (req, res) => {
  const quotes = await MotivationQuote.find().sort({ createdAt: -1 });

  sendResponse(res, { message: 'Motivation speeches retrieved successfully', data: quotes });
});

export const createQuote = catchAsync(async (req, res) => {
  const quote = await MotivationQuote.create({
    ...pick(req.body, ['text', 'author']),
    createdBy: req.user._id
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Motivation speech added successfully',
    data: quote
  });
});

export const updateQuote = catchAsync(async (req, res) => {
  const quote = await MotivationQuote.findByIdAndUpdate(
    req.params.id,
    pick(req.body, ['text', 'author', 'isActive']),
    { new: true, runValidators: true }
  );

  if (!quote) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Motivation speech not found');
  }

  sendResponse(res, { message: 'Motivation speech updated successfully', data: quote });
});

export const deleteQuote = catchAsync(async (req, res) => {
  const quote = await MotivationQuote.findByIdAndDelete(req.params.id);

  if (!quote) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Motivation speech not found');
  }

  sendResponse(res, { message: 'Motivation speech deleted successfully' });
});

export const listCoverMoods = catchAsync(async (req, res) => {
  const coverMoods = await CoverMood.find().sort({ order: 1, createdAt: -1 });

  sendResponse(res, { message: 'Cover moods retrieved successfully', data: coverMoods });
});

export const createCoverMoods = catchAsync(async (req, res) => {
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];

  if (files.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please upload at least one image');
  }

  const results = await uploadManyToCloudinary(files, CLOUDINARY_FOLDERS.COVER_MOODS);

  const coverMoods = await CoverMood.insertMany(
    results.map((result, index) => {
      const image = toImagePayload(result);
      return {
        title: Array.isArray(req.body.title) ? req.body.title[index] || '' : req.body.title || '',
        image: { url: image.url, publicId: image.publicId },
        createdBy: req.user._id
      };
    })
  );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: `${coverMoods.length} cover mood${coverMoods.length === 1 ? '' : 's'} uploaded successfully`,
    data: coverMoods
  });
});

export const deleteCoverMood = catchAsync(async (req, res) => {
  const coverMood = await CoverMood.findById(req.params.id);

  if (!coverMood) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Cover mood not found');
  }

  const inUse = await VisionBoard.countDocuments({ coverMood: coverMood._id, isDeleted: false });

  if (inUse > 0) {
    coverMood.isActive = false;
    await coverMood.save();

    return sendResponse(res, {
      message: `This cover mood is used by ${inUse} board${inUse === 1 ? '' : 's'} so it was deactivated instead of deleted`,
      data: coverMood
    });
  }

  await deleteFromCloudinary(coverMood.image.publicId);
  await coverMood.deleteOne();

  sendResponse(res, { message: 'Cover mood deleted successfully' });
});

export const getPage = catchAsync(async (req, res) => {
  const page = await StaticPage.findOne({ slug: req.params.slug });

  if (!page) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Page not found');
  }

  sendResponse(res, { message: 'Page retrieved successfully', data: page });
});

export const updatePage = catchAsync(async (req, res) => {
  const page = await StaticPage.findOneAndUpdate(
    { slug: req.params.slug },
    { ...pick(req.body, ['title', 'content']), updatedBy: req.user._id },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  sendResponse(res, { message: 'Page updated successfully', data: page });
});
