import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import sendResponse from '../utils/sendResponse.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

export const uploadImage = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Please upload an image file');
  }

  const result = await uploadToCloudinary(req.file.buffer, req.body.folder);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Image uploaded successfully',
    data: {
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes
    }
  });
});

export const deleteImage = catchAsync(async (req, res) => {
  const { publicId } = req.params;

  if (!publicId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'publicId is required');
  }

  const result = await deleteFromCloudinary(publicId);

  if (!result || (result.result !== 'ok' && result.result !== 'not found')) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to delete image from Cloudinary');
  }

  sendResponse(res, {
    message: 'Image delete request processed successfully',
    data: result
  });
});
