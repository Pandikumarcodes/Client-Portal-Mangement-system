import { Client } from './client.model.js';

export async function createClient(input) {
  return Client.create(input);
}

export async function findClients({ tenantId, page, limit, status }) {
  const filter = { tenantId };
  if (status) filter.status = status;
  const [clients, total] = await Promise.all([
    Client.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Client.countDocuments(filter),
  ]);
  return { clients, total };
}

export async function findClientById({ tenantId, clientId }) {
  return Client.findOne({ _id: clientId, tenantId }).lean();
}

export async function updateClientById({ tenantId, clientId, updates }) {
  const safeUpdates = {};
  for (const field of ['firstName', 'lastName', 'email', 'companyName', 'status']) {
    if (Object.hasOwn(updates, field)) safeUpdates[field] = updates[field];
  }

  return Client.findOneAndUpdate({ _id: clientId, tenantId }, safeUpdates, {
    new: true,
    runValidators: true,
  }).lean();
}
