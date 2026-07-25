import { describe, expect, it, vi } from 'vitest';

import { createInvoiceController } from '../../../src/modules/invoices/invoice.controller.js';

const invoice = {
  id: 'invoice-id',
  projectId: 'project-id',
  invoiceNumber: 'INV-1001',
  amountCents: 125000,
  currency: 'USD',
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-31T00:00:00.000Z',
  status: 'draft',
  notes: null,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
};
const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
const createResponse = () => {
  const response = {};
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
};
const createDependencies = () => ({
  createProjectInvoice: vi.fn().mockResolvedValue(invoice),
  listProjectInvoices: vi.fn().mockResolvedValue({ invoices: [invoice], pagination }),
  getProjectInvoice: vi.fn().mockResolvedValue(invoice),
  updateProjectInvoice: vi.fn().mockResolvedValue(invoice),
});

describe('Invoice controller', () => {
  it('returns a frozen controller with exactly four handlers', () => {
    const controller = createInvoiceController(createDependencies());
    expect(Object.isFrozen(controller)).toBe(true);
    expect(Object.keys(controller)).toEqual(['create', 'list', 'getById', 'update']);
  });

  it('creates from trusted auth tenant and validated params/body only', async () => {
    const dependencies = createDependencies();
    const response = createResponse();
    const body = {
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-31'),
      notes: undefined,
    };
    await createInvoiceController(dependencies).create(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: { params: { projectId: 'project-id' }, body },
        params: { projectId: 'raw-project' },
        body: { ...body, tenantId: 'attacker', amountCents: 1 },
      },
      response,
    );
    expect(dependencies.createProjectInvoice).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      ...body,
    });
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { invoice } });
    expect(response.json.mock.calls[0][0].data.invoice).not.toHaveProperty('tenantId');
  });

  it('lists using validated parent params/query with an explicit envelope', async () => {
    const dependencies = createDependencies();
    const response = createResponse();
    await createInvoiceController(dependencies).list(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: {
          params: { projectId: 'project-id' },
          query: { page: 1, limit: 20, status: 'draft' },
        },
        params: { projectId: 'raw-project' },
        query: { tenantId: 'attacker' },
      },
      response,
    );
    expect(dependencies.listProjectInvoices).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      page: 1,
      limit: 20,
      status: 'draft',
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: { invoices: [invoice], pagination },
    });
  });

  it('gets and updates using validated IDs/body only', async () => {
    const dependencies = createDependencies();
    const controller = createInvoiceController(dependencies);
    await controller.getById(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: { params: { projectId: 'project-id', invoiceId: 'invoice-id' } },
        params: { projectId: 'raw-project', invoiceId: 'raw-invoice' },
      },
      createResponse(),
    );
    const updates = { status: 'paid' };
    const response = createResponse();
    await controller.update(
      {
        auth: { tenantId: 'trusted-tenant' },
        validated: {
          params: { projectId: 'project-id', invoiceId: 'invoice-id' },
          body: updates,
        },
        body: { tenantId: 'attacker', status: 'void' },
      },
      response,
    );
    expect(dependencies.getProjectInvoice).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      invoiceId: 'invoice-id',
    });
    expect(dependencies.updateProjectInvoice).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant',
      projectId: 'project-id',
      invoiceId: 'invoice-id',
      updates,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { invoice } });
  });

  it('propagates service errors without model, logging, payment, or money calculations', async () => {
    const failure = new Error('service failure');
    const dependencies = createDependencies();
    dependencies.getProjectInvoice.mockRejectedValue(failure);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      createInvoiceController(dependencies).getById(
        {
          auth: { tenantId: 'tenant-id' },
          validated: { params: { projectId: 'project-id', invoiceId: 'invoice-id' } },
        },
        createResponse(),
      ),
    ).rejects.toBe(failure);
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});
