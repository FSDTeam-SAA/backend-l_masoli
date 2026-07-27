import { Readable } from 'stream';
import cloudinary from '../config/cloudinary.js';
import env from '../config/env.js';

const resolveFolder = (folder) => {
  if (!folder) return env.CLOUDINARY_FOLDER;
  if (folder.startsWith(`${env.CLOUDINARY_FOLDER}/`)) return folder;
  return `${env.CLOUDINARY_FOLDER}/${folder}`;
};

export const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: resolveFolder(folder), resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

export const uploadManyToCloudinary = async (files, folder) => {
  if (!files || files.length === 0) return [];

  return Promise.all(files.map((file) => uploadToCloudinary(file.buffer, folder)));
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return null;

  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, error.message);
    return null;
  }
};

export const deleteManyFromCloudinary = async (publicIds) => {
  const ids = (publicIds || []).filter(Boolean);
  if (ids.length === 0) return [];

  return Promise.all(ids.map((publicId) => deleteFromCloudinary(publicId)));
};

export const toImagePayload = (result) => ({
  url: result.secure_url,
  publicId: result.public_id,
  width: result.width,
  height: result.height
});
