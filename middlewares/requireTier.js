import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError.js';
import { SUBSCRIPTION_TIER } from '../constants/index.js';

const requireTier = (tier = SUBSCRIPTION_TIER.PREMIUM) => (req, res, next) => {
  if (req.user?.activeTier === tier) return next();

  next(
    new ApiError(
      StatusCodes.FORBIDDEN,
      'This feature is available on the Premium plan. Upgrade to unlock it'
    )
  );
};

export default requireTier;
