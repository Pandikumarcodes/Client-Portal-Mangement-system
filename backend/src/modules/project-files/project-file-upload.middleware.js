import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import multer from 'multer';

import { env } from '../../config/env.js';
import { ApiError } from '../../core/errors/api-error.js';
import { ALLOWED_PROJECT_FILE_TYPES, PROJECT_FILE_LIMITS } from './project-file.constants.js';
import { getProjectFileExtension } from './project-file.mime.js';

const uploadError = (statusCode, code, message, cause) =>
  new ApiError({ statusCode, code, message, cause });
const invalidUpload = (cause) =>
  uploadError(400, 'PROJECT_FILE_UPLOAD_INVALID', 'The file upload request is invalid.', cause);
const missingFile = () => uploadError(400, 'PROJECT_FILE_REQUIRED', 'A file is required.');
const unsupportedType = () =>
  uploadError(415, 'PROJECT_FILE_TYPE_NOT_ALLOWED', 'The selected file type is not allowed.');
const tooLarge = (cause) =>
  uploadError(413, 'PROJECT_FILE_TOO_LARGE', 'The selected file exceeds the allowed size.', cause);

const cleanTemporaryPaths = async (request) => {
  const temporaryPaths = request.projectFileTemporaryPaths ?? [];
  await Promise.all(
    temporaryPaths.map((temporaryPath) =>
      unlink(temporaryPath).catch((error) => {
        if (error?.code !== 'ENOENT') throw error;
      }),
    ),
  );
};

export function createProjectFileUploadMiddleware({
  storageRoot = env.projectFileStorageRoot,
} = {}) {
  const temporaryRoot = path.resolve(storageRoot, '.tmp');
  const storage = multer.diskStorage({
    destination(request, file, callback) {
      void file;
      mkdir(temporaryRoot, { recursive: true })
        .then(() => callback(null, temporaryRoot))
        .catch(callback);
    },
    filename(request, file, callback) {
      const extension = getProjectFileExtension(file.mimetype);
      const temporaryName = `${randomBytes(24).toString('hex')}${extension}`;
      const temporaryPath = path.join(temporaryRoot, temporaryName);
      request.projectFileTemporaryPaths ??= [];
      request.projectFileTemporaryPaths.push(temporaryPath);
      callback(null, temporaryName);
    },
  });
  const parser = multer({
    storage,
    limits: {
      fileSize: PROJECT_FILE_LIMITS.MAX_FILE_SIZE_BYTES,
      files: PROJECT_FILE_LIMITS.MAX_FILES_PER_UPLOAD,
    },
    fileFilter(request, file, callback) {
      void request;
      if (!ALLOWED_PROJECT_FILE_TYPES.includes(file.mimetype)) {
        callback(unsupportedType());
        return;
      }
      callback(null, true);
    },
  }).single('file');

  return (request, response, next) => {
    response.once('finish', () => {
      void cleanTemporaryPaths(request).catch(() => {});
    });

    parser(request, response, (error) => {
      if (!error && !request.file) {
        next(missingFile());
        return;
      }

      if (!error) {
        next();
        return;
      }

      void cleanTemporaryPaths(request).finally(() => {
        if (error instanceof ApiError) {
          next(error);
        } else if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
          next(tooLarge(error));
        } else {
          next(invalidUpload(error));
        }
      });
    });
  };
}

export const projectFileUploadMiddleware = createProjectFileUploadMiddleware();
