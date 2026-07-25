import { ApiClientError } from '../../core/api/api-error.js';

const dashboardShape = Object.freeze({
  clients: Object.freeze(['total', 'active', 'inactive']),
  projects: Object.freeze(['total', 'active', 'onHold', 'completed', 'archived']),
  milestones: Object.freeze(['total', 'pending', 'inProgress', 'completed']),
  files: Object.freeze(['total', 'active', 'archived']),
  invoices: Object.freeze(['total', 'draft', 'sent', 'paid', 'void']),
});

function invalidResponse() {
  return new ApiClientError({
    status: 0,
    code: 'INVALID_RESPONSE',
    message: 'The server returned an invalid response.',
  });
}

function normalizeCount(section, key) {
  if (!Object.prototype.hasOwnProperty.call(section, key)) return 0;
  const value = section[key];
  if (!Number.isInteger(value) || value < 0) throw invalidResponse();
  return value;
}

function normalizeSection(dashboard, sectionName, keys) {
  if (!Object.prototype.hasOwnProperty.call(dashboard, sectionName)) {
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, 0])));
  }

  const section = dashboard[sectionName];
  if (section === null || typeof section !== 'object' || Array.isArray(section)) {
    throw invalidResponse();
  }

  return Object.freeze(
    Object.fromEntries(keys.map((key) => [key, normalizeCount(section, key)])),
  );
}

export function normalizeOrganizationDashboard(dashboard) {
  if (dashboard === null || typeof dashboard !== 'object' || Array.isArray(dashboard)) {
    throw invalidResponse();
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(dashboardShape).map(([sectionName, keys]) => [
        sectionName,
        normalizeSection(dashboard, sectionName, keys),
      ]),
    ),
  );
}
