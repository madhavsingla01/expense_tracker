const fs = require('fs/promises');
const path = require('path');
const CloudinaryStorageService = require('./CloudinaryStorageService');
const SqlUserService = require('./SqlUserService');
const { ValidationError } = require('./ValidationService');

const PUBLIC_PREFIX = '/uploads/profiles/';
const profilesDir = path.join(__dirname, '..', 'uploads', 'profiles');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function resolveProfilePath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string' || !publicPath.startsWith(PUBLIC_PREFIX)) {
    return null;
  }

  const filename = path.basename(publicPath);
  if (!filename || filename !== publicPath.slice(PUBLIC_PREFIX.length)) {
    return null;
  }

  return path.join(profilesDir, filename);
}

function getUserId(userOrId) {
  return String(userOrId?._id || userOrId || '');
}

async function optimizeProfileImage(userOrId, file) {
  if (!file?.buffer) {
    throw new ValidationError('Please upload an image file', 'avatar');
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new ValidationError('Only jpeg, png, and webp profile images are allowed', 'avatar');
  }

  const userId = getUserId(userOrId);
  if (!userId) {
    throw new ValidationError('User id is required for profile image upload', 'avatar');
  }

  let uploadResult;

  try {
    uploadResult = await CloudinaryStorageService.uploadProfileImage(userId, file);
  } catch (error) {
    if (error.field) throw error;
    throw new ValidationError('Could not upload that image. Please try again.', 'avatar');
  }

  if (userOrId && typeof userOrId === 'object') {
    try {
      await SqlUserService.recordUploadForMongoUser(userOrId, file, uploadResult, 'profile_avatar');
    } catch (error) {
      await CloudinaryStorageService.deleteByPublicId(uploadResult.public_id);
      throw error;
    }
  }

  return uploadResult.secure_url || uploadResult.url;
}

async function deleteProfileImage(publicPath) {
  const profilePath = resolveProfilePath(publicPath);
  if (!profilePath) {
    try {
      await CloudinaryStorageService.deleteByUrl(publicPath);
    } catch (error) {
      if (error.message !== 'Cloudinary is not configured') {
        console.error('Failed to delete Cloudinary profile image:', error.message);
      }
    }
    return;
  }

  try {
    await fs.unlink(profilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to delete profile image:', error.message);
    }
  }
}

module.exports = {
  optimizeProfileImage,
  deleteProfileImage,
  resolveProfilePath,
  extractCloudinaryPublicId: CloudinaryStorageService.extractPublicIdFromUrl.bind(CloudinaryStorageService),
};
