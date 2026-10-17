import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError.js';

// Mount after auth() so all feature reads and writes share the same decision.
const requireAccess = (req, res, next) => {
  if (req.user.accessLevel === 'locked') {
    const error = new ApiError(StatusCodes.FORBIDDEN, 'A subscription is required to access this feature');
    error.code = 'SUBSCRIPTION_REQUIRED';
    return next(error);
  }

  return next();
};

export default requireAccess;
