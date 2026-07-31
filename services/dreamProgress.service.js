import mongoose from 'mongoose';
import Dream from '../models/dream.model.js';
import Goal from '../models/goal.model.js';
import VisionBoard from '../models/visionBoard.model.js';
import { GOAL_STATUS } from '../constants/index.js';

export const recomputeDreamProgress = async (dreamId) => {
  if (!dreamId) return null;

  const dream = await Dream.findById(dreamId);
  if (!dream || dream.isDeleted) return null;

  const [row] = await Goal.aggregate([
    {
      $match: {
        dream: new mongoose.Types.ObjectId(String(dream._id)),
        isDeleted: false,
        status: { $ne: GOAL_STATUS.ARCHIVED }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', GOAL_STATUS.COMPLETED] }, 1, 0] } },
        average: { $avg: '$progress' }
      }
    }
  ]);

  dream.totalGoals = row?.total || 0;
  dream.completedGoals = row?.completed || 0;
  dream.progress = row?.total ? Math.round(row.average) : 0;
  await dream.save();

  await recomputeBoardProgress(dream.board);

  return dream;
};

export const recomputeBoardProgress = async (boardId) => {
  if (!boardId) return null;

  const board = await VisionBoard.findById(boardId);
  if (!board || board.isDeleted) return null;

  const [row] = await Dream.aggregate([
    { $match: { board: new mongoose.Types.ObjectId(String(board._id)), isDeleted: false } },
    { $group: { _id: null, total: { $sum: 1 }, average: { $avg: '$progress' } } }
  ]);

  board.dreamCount = row?.total || 0;
  board.progress = row?.total ? Math.round(row.average) : 0;
  board.lastUpdatedAt = new Date();
  await board.save();

  return board;
};

export const recomputeAllDreamsForUser = async (userId) => {
  const dreams = await Dream.find({ user: userId, isDeleted: false }).select('_id');

  await Promise.all(dreams.map((dream) => recomputeDreamProgress(dream._id)));

  return dreams.length;
};
