import { Project } from './project.model.js';

export async function createProject({ tenantId, clientId, name, description }) {
  return Project.create({ tenantId, clientId, name, description });
}

export async function findProjects({ tenantId, page, limit, status, clientId }) {
  const filter = { tenantId };
  if (status) filter.status = status;
  if (clientId) filter.clientId = clientId;

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
  ]);

  return { projects, total };
}

export async function findProjectById({ tenantId, projectId }) {
  return Project.findOne({ _id: projectId, tenantId }).lean();
}

export async function updateProjectById({ tenantId, projectId, updates }) {
  const safeUpdates = {};
  for (const field of ['clientId', 'name', 'description', 'status']) {
    if (Object.hasOwn(updates, field)) safeUpdates[field] = updates[field];
  }

  return Project.findOneAndUpdate({ _id: projectId, tenantId }, safeUpdates, {
    new: true,
    runValidators: true,
  }).lean();
}
