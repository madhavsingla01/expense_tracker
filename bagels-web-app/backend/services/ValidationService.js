/**
 * Validation Service
 * Centralized input validation for all services
 */

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email');
  }
};

const validatePassword = (password) => {
  if (!password || password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters', 'password');
  }
};

const validateAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new ValidationError('Amount must be a positive number', 'amount');
  }
  return num;
};

const validateRequiredField = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
  return value;
};

const validateEnum = (value, enumArray, fieldName) => {
  if (!enumArray.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${enumArray.join(', ')}`,
      fieldName
    );
  }
};

const validateDate = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format', 'date');
  }
  return date;
};

const validatePhoneNumber = (phone) => {
  const phoneRegex = /^\d{7,15}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    throw new ValidationError('Invalid phone number format', 'phoneNumber');
  }
};

module.exports = {
  ValidationError,
  validateEmail,
  validatePassword,
  validateAmount,
  validateRequiredField,
  validateEnum,
  validateDate,
  validatePhoneNumber,
};
