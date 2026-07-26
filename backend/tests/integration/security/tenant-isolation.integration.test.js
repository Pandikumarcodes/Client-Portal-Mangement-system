import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import {
  getTenantClient,
  listTenantClients,
  updateTenantClient,
} from '../../../src/modules/clients/client.service.js';
import { getOrganizationDashboard } from '../../../src/modules/dashboard/dashboard.service.js';
import { updateProjectInvoice } from '../../../src/modules/invoices/invoice.service.js';
import {
  getProjectFile,
  prepareProjectFileDownload,
} from '../../../src/modules/project-files/project-file.service.js';
import {
  getTenantProject,
  listTenantProjects,
  updateTenantProject,
} from '../../../src/modules/projects/project.service.js';

const tenantA = 'tenant-a';
const tenantB = 'tenant-b';
const clientA = {
  _id: 'client-a',
  tenantId: tenantA,
  firstName: 'Ada',
  lastName: 'A',
  email: 'ada@example.test',
  status: 'active',
};
const clientB = { ...clientA, _id: 'client-b', tenantId: tenantB, firstName: 'Berta' };
const projectA = {
  _id: 'project-a',
  tenantId: tenantA,
  clientId: clientA._id,
  name: 'A Project',
  status: 'active',
};
const projectB = { ...projectA, _id: 'project-b', tenantId: tenantB, clientId: clientB._id };
const fileB = {
  _id: 'file-b',
  tenantId: tenantB,
  projectId: projectB._id,
  originalName: 'private.pdf',
  storagePath: 'private-storage-name.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 7,
  status: 'active',
};
const invoiceB = {
  _id: 'invoice-b',
  tenantId: tenantB,
  projectId: projectB._id,
  invoiceNumber: 'B-1',
  amountCents: 100,
  currency: 'USD',
  issueDate: new Date('2026-01-01'),
  dueDate: new Date('2026-01-02'),
  status: 'draft',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const tenantLookup = (records, idName) => async (input) =>
  records.find((record) => record.tenantId === input.tenantId && record._id === input[idName]) ??
  null;

describe('cross-module tenant isolation', () => {
  it('makes cross-tenant Client reads and updates indistinguishable from missing records', async () => {
    const findClientById = vi.fn(tenantLookup([clientA, clientB], 'clientId'));
    const updateClientById = vi.fn(async (input) => {
      const record = await tenantLookup([clientA, clientB], 'clientId')(input);
      return record ? { ...record, ...input.updates } : null;
    });

    await expect(
      getTenantClient({ tenantId: tenantA, clientId: clientB._id }, { findClientById }),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' });
    await expect(
      updateTenantClient(
        { tenantId: tenantA, clientId: clientB._id, updates: { firstName: 'Changed' } },
        { updateClientById },
      ),
    ).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' });
    expect(JSON.stringify(findClientById.mock.calls)).not.toContain(tenantB);
    expect(JSON.stringify(updateClientById.mock.calls)).not.toContain(tenantB);
  });

  it('excludes other tenants from Client and Project lists', async () => {
    const clients = await listTenantClients(
      { tenantId: tenantA, page: 1, limit: 20 },
      {
        findClients: async ({ tenantId }) => ({
          clients: [clientA, clientB].filter((record) => record.tenantId === tenantId),
          total: 1,
        }),
      },
    );
    const projects = await listTenantProjects(
      { tenantId: tenantA, page: 1, limit: 20 },
      {
        findProjects: async ({ tenantId }) => ({
          projects: [projectA, projectB].filter((record) => record.tenantId === tenantId),
          total: 1,
        }),
      },
    );
    expect(clients.clients.map((record) => record.id)).toEqual(['client-a']);
    expect(projects.projects.map((record) => record.id)).toEqual(['project-a']);
    expect(JSON.stringify({ clients, projects })).not.toContain(tenantB);
  });

  it('makes cross-tenant Project reads and updates appear missing', async () => {
    const findProjectById = vi.fn(tenantLookup([projectA, projectB], 'projectId'));
    const updateProjectById = vi.fn(async (input) => {
      const record = await tenantLookup([projectA, projectB], 'projectId')(input);
      return record ? { ...record, ...input.updates } : null;
    });
    await expect(
      getTenantProject({ tenantId: tenantA, projectId: projectB._id }, { findProjectById }),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    await expect(
      updateTenantProject(
        { tenantId: tenantA, projectId: projectB._id, updates: { name: 'Changed' } },
        { findProjectById, updateProjectById },
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    expect(updateProjectById).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenantA, projectId: projectB._id }),
    );
  });

  it('checks the tenant-scoped parent before File metadata or content lookup', async () => {
    const findProjectById = vi.fn(tenantLookup([projectA, projectB], 'projectId'));
    const findProjectFileById = vi.fn(tenantLookup([fileB], 'fileId'));
    const openStoredFile = vi.fn(async () => Readable.from('private'));
    const input = { tenantId: tenantA, projectId: projectB._id, fileId: fileB._id };

    await expect(
      getProjectFile(input, { findProjectById, findProjectFileById }),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    await expect(
      prepareProjectFileDownload(input, {
        findProjectById,
        findProjectFileById,
        openStoredFile,
      }),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    expect(findProjectFileById).not.toHaveBeenCalled();
    expect(openStoredFile).not.toHaveBeenCalled();
  });

  it('checks the tenant-scoped parent before Invoice mutation', async () => {
    const findProjectById = vi.fn(tenantLookup([projectA, projectB], 'projectId'));
    const findInvoiceById = vi.fn(tenantLookup([invoiceB], 'invoiceId'));
    const updateInvoiceById = vi.fn();

    await expect(
      updateProjectInvoice(
        {
          tenantId: tenantA,
          projectId: projectB._id,
          invoiceId: invoiceB._id,
          updates: { status: 'paid', projectId: projectA._id, tenantId: tenantA },
        },
        { findProjectById, findInvoiceById, updateInvoiceById },
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    expect(findInvoiceById).not.toHaveBeenCalled();
    expect(updateInvoiceById).not.toHaveBeenCalled();
  });

  it('keeps dashboard counts tenant-scoped and omits tenant identifiers', async () => {
    const getOrganizationDashboardCounts = vi.fn(async ({ tenantId }) => ({
      clients: {
        total: [clientA, clientB].filter((record) => record.tenantId === tenantId).length,
        statuses: { active: 1, inactive: 0 },
      },
      projects: {
        total: [projectA, projectB].filter((record) => record.tenantId === tenantId).length,
        statuses: { active: 1 },
      },
      milestones: { total: 0, statuses: {} },
      files: { total: 0, statuses: {} },
      invoices: { total: 0, statuses: {} },
    }));
    const dashboard = await getOrganizationDashboard(
      { tenantId: tenantA },
      { getOrganizationDashboardCounts },
    );
    expect(dashboard.clients.total).toBe(1);
    expect(dashboard.projects.total).toBe(1);
    expect(JSON.stringify(dashboard)).not.toContain('tenant-');
  });
});
