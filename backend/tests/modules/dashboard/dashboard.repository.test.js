import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const model = () => ({
    countDocuments: vi.fn(),
    estimatedDocumentCount: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
    populate: vi.fn(),
  });

  return {
    Client: model(),
    Project: model(),
    ProjectFile: model(),
    Invoice: model(),
  };
});

vi.mock('../../../src/modules/clients/client.model.js', () => ({ Client: mocks.Client }));
vi.mock('../../../src/modules/projects/project.model.js', () => ({ Project: mocks.Project }));
vi.mock('../../../src/modules/project-files/project-file.model.js', () => ({
  ProjectFile: mocks.ProjectFile,
}));
vi.mock('../../../src/modules/invoices/invoice.model.js', () => ({ Invoice: mocks.Invoice }));

const { getOrganizationDashboardCounts } =
  await import('../../../src/modules/dashboard/dashboard.repository.js');

const expectedStatuses = Object.freeze({
  Client: ['active', 'inactive'],
  Project: ['active', 'on_hold', 'completed', 'archived'],
  ProjectFile: ['active', 'archived'],
  Invoice: ['draft', 'sent', 'paid', 'void'],
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const [modelName, statuses] of Object.entries(expectedStatuses)) {
    mocks[modelName].countDocuments.mockImplementation(async (filter) =>
      filter.status === undefined ? statuses.length + 10 : statuses.indexOf(filter.status) + 1,
    );
  }
});

describe('dashboard repository', () => {
  it('counts every existing entity total and approved status with tenant-scoped filters', async () => {
    const result = await getOrganizationDashboardCounts({ tenantId: 'tenant-id' });

    for (const [modelName, statuses] of Object.entries(expectedStatuses)) {
      expect(mocks[modelName].countDocuments).toHaveBeenCalledTimes(statuses.length + 1);
      expect(mocks[modelName].countDocuments).toHaveBeenCalledWith({ tenantId: 'tenant-id' });
      for (const status of statuses) {
        expect(mocks[modelName].countDocuments).toHaveBeenCalledWith({
          tenantId: 'tenant-id',
          status,
        });
      }
      for (const [filter] of mocks[modelName].countDocuments.mock.calls) {
        expect(filter).toHaveProperty('tenantId', 'tenant-id');
      }
    }

    expect(result.clients).toEqual({
      total: 12,
      statuses: { active: 1, inactive: 2 },
    });
    expect(result.projects).toEqual({
      total: 14,
      statuses: { active: 1, on_hold: 2, completed: 3, archived: 4 },
    });
    expect(result.files).toEqual({
      total: 12,
      statuses: { active: 1, archived: 2 },
    });
    expect(result.invoices).toEqual({
      total: 14,
      statuses: { draft: 1, sent: 2, paid: 3, void: 4 },
    });
    expect(result.milestones).toEqual({ total: 0, statuses: {} });
  });

  it('does not load, populate, estimate, or aggregate records and opens no connection', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');

    await getOrganizationDashboardCounts({ tenantId: 'tenant-id' });

    for (const modelName of Object.keys(expectedStatuses)) {
      expect(mocks[modelName].find).not.toHaveBeenCalled();
      expect(mocks[modelName].populate).not.toHaveBeenCalled();
      expect(mocks[modelName].estimatedDocumentCount).not.toHaveBeenCalled();
      expect(mocks[modelName].aggregate).not.toHaveBeenCalled();
    }
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });

  it('rejects missing tenant context before any count query runs', async () => {
    await expect(getOrganizationDashboardCounts({ tenantId: '' })).rejects.toThrow(TypeError);

    for (const modelName of Object.keys(expectedStatuses)) {
      expect(mocks[modelName].countDocuments).not.toHaveBeenCalled();
    }
  });

  it('propagates count failures unchanged', async () => {
    const failure = new Error('count failed');
    mocks.Client.countDocuments.mockRejectedValue(failure);

    await expect(getOrganizationDashboardCounts({ tenantId: 'tenant-id' })).rejects.toBe(failure);
  });
});
