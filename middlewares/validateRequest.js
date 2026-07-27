import catchAsync from '../utils/catchAsync.js';

const validateRequest = (schema) =>
  catchAsync(async (req, res, next) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.validatedQuery = parsed.query;
    if (parsed.params) req.validatedParams = parsed.params;

    next();
  });

export default validateRequest;
