const crypto = require('crypto');
const { getCloudinary } = require('../config/cloudinary');

class CloudinaryStorageService {
  getProfileFolder() {
    return process.env.CLOUDINARY_PROFILE_FOLDER || 'bagels/profiles';
  }

  buildDataUri(file) {
    if (!file?.buffer || !file?.mimetype) {
      const error = new Error('Please upload a valid file');
      error.field = 'file';
      throw error;
    }

    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }

  async uploadProfileImage(userId, file) {
    const cloudinary = getCloudinary();
    const publicId = `${String(userId)}-${Date.now()}-${crypto.randomUUID()}`;

    return cloudinary.uploader.upload(this.buildDataUri(file), {
      folder: this.getProfileFolder(),
      public_id: publicId,
      resource_type: 'image',
      overwrite: false,
      invalidate: true,
      transformation: [
        { width: 512, height: 512, crop: 'fill', gravity: 'auto' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });
  }

  extractPublicIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;

    const uploadMarker = '/image/upload/';
    const markerIndex = url.indexOf(uploadMarker);
    if (markerIndex === -1) return null;

    const afterUpload = url.slice(markerIndex + uploadMarker.length);
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const withoutQuery = withoutVersion.split('?')[0];
    return withoutQuery.replace(/\.[^/.]+$/, '') || null;
  }

  async deleteByPublicId(publicId) {
    if (!publicId) return null;

    const cloudinary = getCloudinary();
    return cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
  }

  async deleteByUrl(url) {
    return this.deleteByPublicId(this.extractPublicIdFromUrl(url));
  }
}

module.exports = new CloudinaryStorageService();
