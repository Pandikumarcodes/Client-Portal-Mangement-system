import path from 'node:path';

import {
  getProjectFile,
  listProjectFiles,
  prepareProjectFileDownload,
  updateProjectFile,
  uploadProjectFile,
} from './project-file.service.js';

const resolveDependencies = (dependencies = {}) => ({
  uploadProjectFile,
  listProjectFiles,
  getProjectFile,
  prepareProjectFileDownload,
  updateProjectFile,
  ...dependencies,
});
const removeControlCharacters = (value) =>
  [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('');
const sanitizeDownloadName = (originalName) => {
  const normalized =
    typeof originalName === 'string' ? originalName.replaceAll('\\', '/') : 'download';
  return (
    removeControlCharacters(path.posix.basename(normalized)).trim().slice(0, 255) || 'download'
  );
};
const createContentDisposition = (originalName) => {
  const safeName = sanitizeDownloadName(originalName);
  const asciiFallback =
    safeName
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_')
      .slice(0, 255) || 'download';
  let encodedName;
  try {
    encodedName = encodeURIComponent(safeName).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  } catch {
    encodedName = encodeURIComponent(asciiFallback);
  }
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
};

export function createProjectFileController(dependencies) {
  const service = resolveDependencies(dependencies);
  const upload = async (request, response) => {
    const file = await service.uploadProjectFile({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      description: request.validated.body.description,
      uploadedFile: request.file,
    });
    return response.status(201).json({ success: true, data: { file } });
  };
  const list = async (request, response) => {
    const result = await service.listProjectFiles({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      page: request.validated.query.page,
      limit: request.validated.query.limit,
      status: request.validated.query.status,
    });
    return response.status(200).json({
      success: true,
      data: {
        files: result.files,
        pagination: result.pagination,
      },
    });
  };
  const getById = async (request, response) => {
    const file = await service.getProjectFile({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      fileId: request.validated.params.fileId,
    });
    return response.status(200).json({ success: true, data: { file } });
  };
  const download = async (request, response, next) => {
    const descriptor = await service.prepareProjectFileDownload({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      fileId: request.validated.params.fileId,
    });
    response.setHeader('Content-Type', descriptor.mimeType);
    if (Number.isInteger(descriptor.sizeBytes) && descriptor.sizeBytes >= 0) {
      response.setHeader('Content-Length', String(descriptor.sizeBytes));
    }
    response.setHeader('Content-Disposition', createContentDisposition(descriptor.originalName));
    response.setHeader('Cache-Control', 'private, no-store');
    descriptor.stream.once('error', next);
    descriptor.stream.pipe(response);
  };
  const update = async (request, response) => {
    const file = await service.updateProjectFile({
      tenantId: request.auth.tenantId,
      projectId: request.validated.params.projectId,
      fileId: request.validated.params.fileId,
      updates: request.validated.body,
    });
    return response.status(200).json({ success: true, data: { file } });
  };

  return Object.freeze({ upload, list, getById, download, update });
}
