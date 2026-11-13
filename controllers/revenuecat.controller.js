import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { planSnapshot } from '../services/plan.service.js';
import { syncUserSubscription } from '../services/revenuecat.service.js';

export const syncMySubscription = catchAsync(async (req, res) => {
  let user;
  try {
    // Caller identity is the only input. Client plan/receipt/body is ignored.
    user = await syncUserSubscription(req.user._id);
  } catch {
    throw new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'Subscription verification is temporarily unavailable. Please try again.');
  }
  if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Account no longer exists');
  sendResponse(res, { message: 'Subscription synced successfully', data: await planSnapshot(user) });
});
