const { v2: cloudinary } = require('cloudinary');

const requiredKeys = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const isCloudinaryConfigured = () => (
  Boolean(process.env.CLOUDINARY_URL)
  || requiredKeys.every((key) => Boolean(process.env[key]))
);

const getCloudinaryConfig = () => {
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      return {
        cloud_name: url.hostname,
        api_key: decodeURIComponent(url.username),
        api_secret: decodeURIComponent(url.password),
        secure: true,
      };
    } catch {
      const error = new Error('Cloudinary URL is invalid');
      error.statusCode = 500;
      throw error;
    }
  }

  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  };
};

const getCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    const error = new Error('Cloudinary is not configured');
    error.statusCode = 500;
    throw error;
  }

  cloudinary.config(getCloudinaryConfig());

  return cloudinary;
};

module.exports = {
  getCloudinary,
  getCloudinaryConfig,
  isCloudinaryConfigured,
};
