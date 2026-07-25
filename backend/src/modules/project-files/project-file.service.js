import path from 'node:path';

import { ApiError } from '../../core/errors/api-error.js';
import { findProjectById } from '../projects/project.repository.js';
import { ALLOWED_PROJECT_FILE_TYPES, PROJECT_FILE_LIMITS } from './project-file.constants.js';
import {
  createProjectFile,
  findProjectFileById,
  findProjectFiles,
  updateProjectFileById,
} from './project-file.repository.js';
import { projectFileStorage } from './project-file.storage.js';

const projectNotFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'PROJECT_NOT_FOUND',
    message: 'The project was not found.',
  });
const projectFileNotFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'PROJECT_FILE_NOT_FOUND',
    message: 'The project file was not found.',
  });
const projectFileRequired = () =>
  new ApiError({
    statusCode: 400,
    code: 'PROJECT_FILE_REQUIRED',
    message: 'A file is required.',
  });
const projectFileTypeNotAllowed = () =>
  new ApiError({
    statusCode: 415,
    code: 'PROJECT_FILE_TYPE_NOT_ALLOWED',
    message: 'The selected file type is not allowed.',
  });
const projectFileTooLarge = () =>
  new ApiError({
    statusCode: 413,
    code: 'PROJECT_FILE_TOO_LARGE',
    message: 'The selected file exceeds the allowed size.',
  });
const projectFileContentNotFound = (cause) =>
  new ApiError({
    statusCode: 404,
    code: 'PROJECT_FILE_CONTENT_NOT_FOUND',
    message: 'The project file content was not found.',
    cause,
  });
const projectFileStorageError = (cause) =>
  new ApiError({
    statusCode: 500,
    code: 'PROJECT_FILE_STORAGE_ERROR',
    message: 'The project file could not be accessed.',
    cause,
  });

const requireTenantId = (tenantId) => {
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new TypeError('A trusted tenant context is required.');
  }
};
const toIsoString = (value) => (value instanceof Date ? value.toISOString() : value);
const toProjectFileDto = (file) =>
  Object.freeze({
    id: String(file._id),
    projectId: String(file.projectId),
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    description: file.description ?? null,
    status: file.status,
    createdAt: toIsoString(file.createdAt),
    updatedAt: toIsoString(file.updatedAt),
  });
const removeControlCharacters = (value) =>
  [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('');
const sanitizeOriginalName = (originalName) => {
  const normalized = typeof originalName === 'string' ? originalName.replaceAll('\\', '/') : '';
  const basename = removeControlCharacters(path.posix.basename(normalized)).trim();
  return (basename || 'file').slice(0, 255);
};
const resolveDependencies = (dependencies = {}) => ({
  findProjectById,
  createProjectFile,
  findProjectFiles,
  findProjectFileById,
  updateProjectFileById,
  persistUploadedFile: projectFileStorage.persistUploadedFile,
  openStoredFile: projectFileStorage.openStoredFile,
  removeStoredFile: projectFileStorage.removeStoredFile,
  ...dependencies,
});
const verifyProject = async (input, dependencies) => {
  const project = await dependencies.findProjectById({
    tenantId: input.tenantId,
    projectId: input.projectId,
  });
  if (!project) throw projectNotFound();
};

export async function uploadProjectFile(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  if (!input.uploadedFile) throw projectFileRequired();
  if (!ALLOWED_PROJECT_FILE_TYPES.includes(input.uploadedFile.mimetype)) {
    throw projectFileTypeNotAllowed();
  }
  if (
    !Number.isInteger(input.uploadedFile.size) ||
    input.uploadedFile.size < 1 ||
    input.uploadedFile.size > PROJECT_FILE_LIMITS.MAX_FILE_SIZE_BYTES
  ) {
    throw projectFileTooLarge();
  }

  const persisted = await resolved.persistUploadedFile({
    temporaryPath: input.uploadedFile.path,
    mimeType: input.uploadedFile.mimetype,
  });

  try {
    const file = await resolved.createProjectFile({
      tenantId: input.tenantId,
      projectId: input.projectId,
      originalName: sanitizeOriginalName(input.uploadedFile.originalname),
      storedName: persisted.storedName,
      storagePath: persisted.storagePath,
      mimeType: input.uploadedFile.mimetype,
      sizeBytes: persisted.sizeBytes,
      description: input.description,
    });
    return toProjectFileDto(file);
  } catch (error) {
    try {
      await resolved.removeStoredFile({ storagePath: persisted.storagePath });
    } catch {
      // Rollback failure must not hide the original metadata persistence error.
    }
    throw error;
  }
}

export async function listProjectFiles(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const result = await resolved.findProjectFiles({
    tenantId: input.tenantId,
    projectId: input.projectId,
    page: input.page,
    limit: input.limit,
    status: input.status,
  });
  return Object.freeze({
    files: Object.freeze(result.files.map(toProjectFileDto)),
    pagination: Object.freeze({
      page: input.page,
      limit: input.limit,
      total: result.total,
      totalPages: result.total ? Math.ceil(result.total / input.limit) : 0,
    }),
  });
}

export async function getProjectFile(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const file = await resolved.findProjectFileById(input);
  if (!file) throw projectFileNotFound();
  return toProjectFileDto(file);
}

export async function prepareProjectFileDownload(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const file = await resolved.findProjectFileById(input);
  if (!file) throw projectFileNotFound();

  let stream;
  try {
    stream = await resolved.openStoredFile({ storagePath: file.storagePath });
  } catch (error) {
    if (error?.code === 'ENOENT') throw projectFileContentNotFound(error);
    if (error?.code === 'PROJECT_FILE_STORAGE_PATH_INVALID') {
      throw projectFileStorageError(error);
    }
    throw error;
  }

  return Object.freeze({
    stream,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });
}

export async function updateProjectFile(input, dependencies) {
  requireTenantId(input.tenantId);
  const resolved = resolveDependencies(dependencies);
  await verifyProject(input, resolved);
  const updates = {};
  for (const field of ['description', 'status']) {
    if (Object.hasOwn(input.updates, field)) updates[field] = input.updates[field];
  }
  if (updates.description === null) updates.description = undefined;
  const file = await resolved.updateProjectFileById({
    tenantId: input.tenantId,
    projectId: input.projectId,
    fileId: input.fileId,
    updates,
  });
  if (!file) throw projectFileNotFound();
  return toProjectFileDto(file);
}
