import { constants as fileSystemConstants } from 'node:fs';
import { access, copyFile, mkdir, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { env } from '../../config/env.js';
import { getProjectFileExtension } from './project-file.mime.js';

const INVALID_STORAGE_PATH_CODE = 'PROJECT_FILE_STORAGE_PATH_INVALID';

const createInvalidStoragePathError = () =>
  Object.assign(new Error('Project File storage path is invalid.'), {
    code: INVALID_STORAGE_PATH_CODE,
  });

const resolveInsideRoot = (storageRoot, storagePath) => {
  if (typeof storagePath !== 'string' || storagePath.length === 0 || path.isAbsolute(storagePath)) {
    throw createInvalidStoragePathError();
  }

  const resolvedPath = path.resolve(storageRoot, storagePath);
  const relativePath = path.relative(storageRoot, resolvedPath);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw createInvalidStoragePathError();
  }

  return resolvedPath;
};

const isInsideRoot = (storageRoot, candidatePath) => {
  const relativePath = path.relative(storageRoot, path.resolve(candidatePath));
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
};

export function createProjectFileStorage({ storageRoot = env.projectFileStorageRoot } = {}) {
  const normalizedRoot = path.resolve(storageRoot);
  if (normalizedRoot === path.parse(normalizedRoot).root) {
    throw new TypeError('Project File storage root must not be a filesystem root.');
  }

  const persistUploadedFile = async ({ temporaryPath, mimeType }) => {
    if (!isInsideRoot(normalizedRoot, temporaryPath)) {
      throw createInvalidStoragePathError();
    }

    const extension = getProjectFileExtension(mimeType);
    if (!extension) {
      throw createInvalidStoragePathError();
    }

    await mkdir(normalizedRoot, { recursive: true });
    const sourceStats = await stat(temporaryPath);
    let storedName;
    let destinationPath;

    for (;;) {
      storedName = `${randomBytes(24).toString('hex')}${extension}`;
      destinationPath = resolveInsideRoot(normalizedRoot, storedName);
      try {
        await copyFile(temporaryPath, destinationPath, fileSystemConstants.COPYFILE_EXCL);
        break;
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
    }

    try {
      await unlink(temporaryPath);
    } catch (error) {
      await unlink(destinationPath).catch(() => {});
      throw error;
    }

    return Object.freeze({
      storedName,
      storagePath: storedName,
      sizeBytes: sourceStats.size,
    });
  };

  const openStoredFile = async ({ storagePath }) => {
    const resolvedPath = resolveInsideRoot(normalizedRoot, storagePath);
    await access(resolvedPath, fileSystemConstants.R_OK);
    return createReadStream(resolvedPath);
  };

  const removeStoredFile = async ({ storagePath }) => {
    const resolvedPath = resolveInsideRoot(normalizedRoot, storagePath);
    try {
      await unlink(resolvedPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  };

  return Object.freeze({
    persistUploadedFile,
    openStoredFile,
    removeStoredFile,
  });
}

export const projectFileStorage = createProjectFileStorage();
