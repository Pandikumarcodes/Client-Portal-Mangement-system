import { getOrganizationDashboardCounts } from './dashboard.repository.js';

const resolveDependencies = (dependencies = {}) => ({
  getOrganizationDashboardCounts,
  ...dependencies,
});

const normalizeCount = (value) => {
  if (
    value === undefined ||
    value === null ||
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 0;
  }
  if (value < 0) {
    throw new RangeError('Dashboard counts cannot be negative.');
  }
  return Math.trunc(value);
};

const createStatusCounts = (result, mappings) =>
  Object.fromEntries(
    mappings.map(([storedStatus, dtoKey]) => [
      dtoKey,
      normalizeCount(result?.statuses?.[storedStatus]),
    ]),
  );

export async function getOrganizationDashboard(input, dependencies) {
  if (typeof input?.tenantId !== 'string' || input.tenantId.trim().length === 0) {
    throw new TypeError('Dashboard tenantId is required.');
  }

  const result = await resolveDependencies(dependencies).getOrganizationDashboardCounts({
    tenantId: input.tenantId,
  });

  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('Dashboard repository returned an invalid result.');
  }

  return Object.freeze({
    clients: Object.freeze({
      total: normalizeCount(result.clients?.total),
      ...createStatusCounts(result.clients, [
        ['active', 'active'],
        ['inactive', 'inactive'],
      ]),
    }),
    projects: Object.freeze({
      total: normalizeCount(result.projects?.total),
      ...createStatusCounts(result.projects, [
        ['active', 'active'],
        ['on_hold', 'onHold'],
        ['completed', 'completed'],
        ['archived', 'archived'],
      ]),
    }),
    milestones: Object.freeze({
      total: normalizeCount(result.milestones?.total),
      ...createStatusCounts(result.milestones, [
        ['pending', 'pending'],
        ['in_progress', 'inProgress'],
        ['completed', 'completed'],
      ]),
    }),
    files: Object.freeze({
      total: normalizeCount(result.files?.total),
      ...createStatusCounts(result.files, [
        ['active', 'active'],
        ['archived', 'archived'],
      ]),
    }),
    invoices: Object.freeze({
      total: normalizeCount(result.invoices?.total),
      ...createStatusCounts(result.invoices, [
        ['draft', 'draft'],
        ['sent', 'sent'],
        ['paid', 'paid'],
        ['void', 'void'],
      ]),
    }),
  });
}
