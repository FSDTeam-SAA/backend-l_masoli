import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import QueryBuilder from '../utils/QueryBuilder.js';
import Goal from '../models/goal.model.js';
import Milestone from '../models/milestone.model.js';
import MotivationQuote from '../models/motivationQuote.model.js';
import Dream from '../models/dream.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import { GOAL_STATUS } from '../constants/index.js';
import { overallProgress } from '../services/analytics.service.js';
import { greetingFor, progressSubtitle, relativeDueLabel, formatDateLabel } from '../utils/labelHelper.js';

const UPCOMING_LIMIT = 3;
const DREAM_BANNER_LIMIT = 12;

const loadDreamBanner = async (userId) => {
  const boards = await VisionBoard.find({ user: userId, isDeleted: false }).select('_id').lean();
  if (!boards.length) return [];

  // Twelve image-bearing dreams are enough to fill the strip's first round.
  const dreams = await Dream.find({
    user: userId,
    isDeleted: false,
    board: { $in: boards.map((board) => board._id) },
    'images.url': { $regex: /\S/ }
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(DREAM_BANNER_LIMIT)
    .select('board title images.url')
    .lean();

  const imageSets = dreams.map((dream) =>
    dream.images.map((image) => image.url?.trim()).filter(Boolean)
  );
  const banner = [];
  // Preserve images[0] as cover, then take one image per dream each round.
  for (let imageIndex = 0; banner.length < DREAM_BANNER_LIMIT; imageIndex += 1) {
    let added = false;
    for (let dreamIndex = 0; dreamIndex < dreams.length; dreamIndex += 1) {
      const imageUrl = imageSets[dreamIndex][imageIndex];
      if (!imageUrl) continue;
      const dream = dreams[dreamIndex];
      banner.push({ dreamId: dream._id, boardId: dream.board, title: dream.title, imageUrl });
      added = true;
      if (banner.length === DREAM_BANNER_LIMIT) break;
    }
    if (!added) break;
  }
  return banner;
};

const randomQuote = async (excludeId) => {
  const match = { isActive: true };

  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    const [quote] = await MotivationQuote.aggregate([
      { $match: { ...match, _id: { $ne: new mongoose.Types.ObjectId(excludeId) } } },
      { $sample: { size: 1 } }
    ]);

    if (quote) return quote;
  }

  const [quote] = await MotivationQuote.aggregate([{ $match: match }, { $sample: { size: 1 } }]);

  return quote || null;
};

const decorateUpcoming = (milestone, timezone) => ({
  _id: milestone._id,
  title: milestone.title,
  dueDate: milestone.dueDate,
  dueLabel: relativeDueLabel(milestone.dueDate, timezone),
  dueDateLabel: formatDateLabel(milestone.dueDate, timezone),
  goalId: milestone.goal?._id || milestone.goal,
  goalTitle: milestone.goal?.title || ''
});

export const getHome = catchAsync(async (req, res) => {
  const { _id: userId, timezone } = req.user;

  const [motivation, progress, activeGoals, completedGoals, upcoming, dreamBanner] = await Promise.all([
    randomQuote(),
    overallProgress(userId),
    Goal.countDocuments({ user: userId, isDeleted: false, status: GOAL_STATUS.ACTIVE }),
    Goal.countDocuments({ user: userId, isDeleted: false, status: GOAL_STATUS.COMPLETED }),
    Milestone.find({ user: userId, isDeleted: false, isCompleted: false })
      .sort({ dueDate: 1 })
      .limit(UPCOMING_LIMIT)
      .populate({ path: 'goal', select: 'title' }),
    loadDreamBanner(userId)
  ]);

  sendResponse(res, {
    message: 'Home retrieved successfully',
    data: {
      user: {
        _id: userId,
        userName: req.user.userName,
        fullName: req.user.fullName,
        avatar: req.user.avatar,
        greeting: greetingFor(timezone)
      },
      motivation,
      dreamBanner,
      dreamProgress: {
        overallProgress: progress,
        subtitle: progressSubtitle(progress),
        activeGoals,
        completedGoals
      },
      upcomingMilestones: upcoming.map((milestone) => decorateUpcoming(milestone, timezone))
    }
  });
});

export const getMotivation = catchAsync(async (req, res) => {
  const quote = await randomQuote(req.query.exclude);

  sendResponse(res, {
    message: 'Motivation retrieved successfully',
    data: quote
  });
});

export const getUpcomingMilestones = catchAsync(async (req, res) => {
  const builder = new QueryBuilder(
    Milestone.find({ user: req.user._id, isDeleted: false, isCompleted: false }).populate({
      path: 'goal',
      select: 'title'
    }),
    req.query
  )
    .sort('dueDate')
    .paginate();

  const [milestones, meta] = await Promise.all([builder.modelQuery, builder.countTotal()]);

  sendResponse(res, {
    message: 'Upcoming milestones retrieved successfully',
    meta,
    data: milestones.map((milestone) => decorateUpcoming(milestone, req.user.timezone))
  });
});
