import { ProjectFile } from './project-file.model.js';

export async function createProjectFile({
  tenantId,
  projectId,
  originalName,
  storedName,
  storagePath,
  mimeType,
  sizeBytes,
  description,
}) {
  return ProjectFile.create({
    tenantId,
    projectId,
    originalName,
    storedName,
    storagePath,
    mimeType,
    sizeBytes,
    description,
  });
}

export async function findProjectFiles({ tenantId, projectId, page, limit, status }) {
  const filter = { tenantId, projectId };
  if (status) filter.status = status;

  const [files, total] = await Promise.all([
    ProjectFile.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProjectFile.countDocuments(filter),
  ]);

  return { files, total };
}

export async function findProjectFileById({ tenantId, projectId, fileId }) {
  return ProjectFile.findOne({ _id: fileId, tenantId, projectId }).lean();
}

export async function updateProjectFileById({ tenantId, projectId, fileId, updates }) {
  const setUpdates = {};
  const updateOperation = {};
  if (Object.hasOwn(updates, 'description')) {
    if (updates.description === undefined) {
      updateOperation.$unset = { description: 1 };
    } else {
      setUpdates.description = updates.description;
    }
  }
  if (Object.hasOwn(updates, 'status')) {
    setUpdates.status = updates.status;
  }
  if (Object.keys(setUpdates).length > 0) {
    updateOperation.$set = setUpdates;
  }

  return ProjectFile.findOneAndUpdate({ _id: fileId, tenantId, projectId }, updateOperation, {
    new: true,
    runValidators: true,
  }).lean();
}
