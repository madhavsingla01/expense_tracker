// 404 handler — route not found
const notFound = (req, res, next) => {
  const error = new Error(`Not Found — ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  // Determine proper status code based on error type
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  if (err.statusCode) {
    statusCode = err.statusCode;
  }

  // ValidationError from our services should be 400
  if (err.name === 'ValidationError' || err.name === 'MongoServerError') {
    statusCode = 400;
  }

  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Profile image must be 5 MB or smaller';
    }
  }

  if (err.field) {
    statusCode = 400;
  }

  if (err.message && err.message.includes('profile images are allowed')) {
    statusCode = 400;
  }

  // Not found errors
  if (err.message && err.message.toLowerCase().includes('not found')) {
    statusCode = 404;
  }

  console.error('Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    message: err.message,
    field: err.field || undefined,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
