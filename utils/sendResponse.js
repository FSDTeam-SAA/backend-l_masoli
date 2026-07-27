import { StatusCodes } from 'http-status-codes';

const sendResponse = (res, { statusCode = StatusCodes.OK, message = 'Success', data, meta }) => {
  const payload = {
    success: true,
    message
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  if (data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

export default sendResponse;
