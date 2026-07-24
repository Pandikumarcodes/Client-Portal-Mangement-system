import bcrypt from 'bcryptjs';

const PASSWORD_WORK_FACTOR = 12;
const PASSWORD_ERROR_MESSAGE = 'Password must be a non-empty string.';
const PASSWORD_LENGTH_ERROR_MESSAGE = 'Password must not exceed 128 characters.';
const PASSWORD_HASH_ERROR_MESSAGE = 'Password hash must be a non-empty string.';

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError(PASSWORD_ERROR_MESSAGE);
  }

  if (password.length > 128) {
    throw new TypeError(PASSWORD_LENGTH_ERROR_MESSAGE);
  }
};

const validatePasswordHash = (passwordHash) => {
  if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
    throw new TypeError(PASSWORD_HASH_ERROR_MESSAGE);
  }
};

export async function hashPassword(password) {
  validatePassword(password);

  return bcrypt.hash(password, PASSWORD_WORK_FACTOR);
}

export async function verifyPassword(password, passwordHash) {
  validatePassword(password);
  validatePasswordHash(passwordHash);

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}
