import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

const buildZodError = (err) => ({
  statusCode: StatusCodes.BAD_REQUEST,
  message: 'Validation failed',
  errorSources: err.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
});

const buildValidationError = (err) => ({
  statusCode: StatusCodes.BAD_REQUEST,
  message: 'Validation failed',
  errorSources: Object.values(err.errors).map((error) => ({
    path: error.path,
    message: error.message
  }))
});

const buildCastError = (err) => ({
  statusCode: StatusCodes.BAD_REQUEST,
  message: `Invalid value for "${err.path}"`,
  errorSources: [{ path: err.path, message: `${err.value} is not a valid ${err.kind}` }]
});

const buildDuplicateError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';

  return {
    statusCode: StatusCodes.CONFLICT,
    message: `This ${field} is already in use`,
    errorSources: [{ path: field, message: `${field} must be unique` }]
  };
};

const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Something went wrong';
  let errorSources = err.errorSources;

  if (err instanceof ZodError) {
    ({ statusCode, message, errorSources } = buildZodError(err));
  } else if (err.name === 'ValidationError' && err.errors) {
    ({ statusCode, message, errorSources } = buildValidationError(err));
  } else if (err.name === 'CastError') {
    ({ statusCode, message, errorSources } = buildCastError(err));
  } else if (err.code === 11000) {
    ({ statusCode, message, errorSources } = buildDuplicateError(err));
  } else if (err.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Session expired. Please sign in again';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  } else if (err.name === 'MulterError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  } else if (err.http_code) {
    statusCode = err.http_code;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errorSources && { errorSources }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

export default globalErrorHandler;
