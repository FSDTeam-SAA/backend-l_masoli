import { StatusCodes } from 'http-status-codes';
import ApiError from '../utils/ApiError.js';

const parseJsonBody = (field = 'data') => (req, res, next) => {
  if (!req.body || typeof req.body[field] !== 'string') return next();

  try {
    const parsed = JSON.parse(req.body[field]);
    delete req.body[field];
    req.body = { ...req.body, ...parsed };
    next();
  } catch {
    next(new ApiError(StatusCodes.BAD_REQUEST, `Field "${field}" must contain valid JSON`));
  }
};

export default parseJsonBody;
