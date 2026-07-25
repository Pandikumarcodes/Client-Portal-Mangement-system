import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createProjectInvoice,
  getProjectInvoice,
  listProjectInvoices,
  updateProjectInvoice,
} from '../../../src/modules/invoices/invoice.service.js';

const tenantId = 'tenant-id';
const projectId = 'project-id';
const invoiceId = 'invoice-id';
const record = {
  _id: invoiceId,
  tenantId,
  projectId,
  invoiceNumber: 'INV-1001',
  amountCents: 125000,
  currency: 'USD',
  issueDate: new Date('2026-08-01T00:00:00.000Z'),
  dueDate: new Date('2026-08-31T00:00:00.000Z'),
  status: 'draft',
  notes: undefined,
  createdAt: new Date('2026-07-25T00:00:00.000Z'),
  updatedAt: new Date('2026-07-25T00:00:00.000Z'),
  __v: 3,
  internal: 'private',
};
const safeDto = {
  id: invoiceId,
  projectId,
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

let dependencies;

beforeEach(() => {
  dependencies = {
    findProjectById: vi.fn().mockResolvedValue({ _id: projectId }),
    createInvoice: vi.fn().mockResolvedValue(record),
    findInvoices: vi.fn().mockResolvedValue({ invoices: [record], total: 1 }),
    findInvoiceById: vi.fn().mockResolvedValue(record),
    updateInvoiceById: vi.fn().mockResolvedValue(record),
  };
});

describe('Invoice service', () => {
  it('verifies Project first, creates with trusted scope, and returns a safe frozen DTO', async () => {
    const input = {
      tenantId,
      projectId,
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-31T00:00:00.000Z'),
      notes: undefined,
    };
    const result = await createProjectInvoice(input, dependencies);
    expect(dependencies.findProjectById).toHaveBeenCalledWith({ tenantId, projectId });
    expect(dependencies.findProjectById.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.createInvoice.mock.invocationCallOrder[0],
    );
    expect(dependencies.createInvoice).toHaveBeenCalledWith(input);
    expect(result).toEqual(safeDto);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('__v');
    expect(result).not.toHaveProperty('internal');
    expect(Number.isInteger(result.amountCents)).toBe(true);
  });

  it('makes missing/cross-tenant Projects indistinguishable and stops Invoice access', async () => {
    dependencies.findProjectById.mockResolvedValue(null);
    await expect(
      createProjectInvoice(
        {
          tenantId,
          projectId,
          invoiceNumber: 'INV',
          amountCents: 1,
          issueDate: new Date('2026-08-01'),
          dueDate: new Date('2026-08-01'),
        },
        dependencies,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
      message: 'The project was not found.',
    });
    expect(dependencies.createInvoice).not.toHaveBeenCalled();
    expect(dependencies.findInvoiceById).not.toHaveBeenCalled();
  });

  it('rejects invalid create date ranges without creating', async () => {
    await expect(
      createProjectInvoice(
        {
          tenantId,
          projectId,
          invoiceNumber: 'INV',
          amountCents: 1,
          issueDate: new Date('2026-09-01'),
          dueDate: new Date('2026-08-31'),
        },
        dependencies,
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVOICE_DATE_RANGE_INVALID',
      message: 'The due date must be on or after the issue date.',
    });
    expect(dependencies.createInvoice).not.toHaveBeenCalled();
  });

  it('verifies Project before listing and maps frozen safe DTOs with pagination', async () => {
    const result = await listProjectInvoices(
      { tenantId, projectId, page: 1, limit: 20, status: 'draft' },
      dependencies,
    );
    expect(dependencies.findProjectById.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.findInvoices.mock.invocationCallOrder[0],
    );
    expect(dependencies.findInvoices).toHaveBeenCalledWith({
      tenantId,
      projectId,
      page: 1,
      limit: 20,
      status: 'draft',
    });
    expect(result).toEqual({
      invoices: [safeDto],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.invoices)).toBe(true);
    expect(Object.isFrozen(result.pagination)).toBe(true);
  });

  it('returns zero totalPages for an empty list', async () => {
    dependencies.findInvoices.mockResolvedValue({ invoices: [], total: 0 });
    await expect(
      listProjectInvoices({ tenantId, projectId, page: 1, limit: 20 }, dependencies),
    ).resolves.toMatchObject({
      invoices: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });

  it('verifies Project before getting and translates a missing Invoice safely', async () => {
    await expect(
      getProjectInvoice({ tenantId, projectId, invoiceId }, dependencies),
    ).resolves.toEqual(safeDto);
    expect(dependencies.findInvoiceById).toHaveBeenCalledWith({
      tenantId,
      projectId,
      invoiceId,
    });
    dependencies.findInvoiceById.mockResolvedValue(null);
    await expect(
      getProjectInvoice({ tenantId, projectId, invoiceId }, dependencies),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'INVOICE_NOT_FOUND',
      message: 'The invoice was not found.',
    });
  });

  it('loads the existing Invoice and validates an issueDate-only update against stored dueDate', async () => {
    await expect(
      updateProjectInvoice(
        {
          tenantId,
          projectId,
          invoiceId,
          updates: { issueDate: new Date('2026-09-01') },
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: 'INVOICE_DATE_RANGE_INVALID' });
    expect(dependencies.findInvoiceById).toHaveBeenCalledWith({
      tenantId,
      projectId,
      invoiceId,
    });
    expect(dependencies.updateInvoiceById).not.toHaveBeenCalled();
  });

  it('validates a dueDate-only update against stored issueDate', async () => {
    await expect(
      updateProjectInvoice(
        {
          tenantId,
          projectId,
          invoiceId,
          updates: { dueDate: new Date('2026-07-31') },
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: 'INVOICE_DATE_RANGE_INVALID' });
    expect(dependencies.updateInvoiceById).not.toHaveBeenCalled();
  });

  it('passes only allowed scoped updates and converts null notes for clearing', async () => {
    const updated = {
      ...record,
      invoiceNumber: 'INV-2',
      status: 'paid',
      notes: undefined,
    };
    dependencies.updateInvoiceById.mockResolvedValue(updated);
    const result = await updateProjectInvoice(
      {
        tenantId,
        projectId,
        invoiceId,
        updates: {
          invoiceNumber: 'INV-2',
          status: 'paid',
          notes: null,
          tenantId: 'attacker',
          projectId: 'attacker-project',
          currency: 'EUR',
          paidAt: new Date(),
          paymentId: 'private',
        },
      },
      dependencies,
    );
    expect(dependencies.updateInvoiceById).toHaveBeenCalledWith({
      tenantId,
      projectId,
      invoiceId,
      updates: { invoiceNumber: 'INV-2', status: 'paid', notes: undefined },
    });
    expect(result.status).toBe('paid');
    expect(result.notes).toBeNull();
    expect(result).not.toHaveProperty('paidAt');
    expect(result).not.toHaveProperty('sentAt');
    expect(result).not.toHaveProperty('overdue');
    expect(result).not.toHaveProperty('paymentId');
  });

  it.each(['sent', 'paid', 'void'])('treats %s as a manual record status only', async (status) => {
    dependencies.updateInvoiceById.mockResolvedValue({ ...record, status });
    const result = await updateProjectInvoice(
      { tenantId, projectId, invoiceId, updates: { status } },
      dependencies,
    );
    expect(result.status).toBe(status);
    expect(result).not.toHaveProperty('sentAt');
    expect(result).not.toHaveProperty('paidAt');
    expect(result).not.toHaveProperty('voidedAt');
    expect(dependencies.updateInvoiceById).toHaveBeenCalledOnce();
  });

  it('translates missing load/update targets and propagates unexpected errors unchanged', async () => {
    dependencies.findInvoiceById.mockResolvedValue(null);
    await expect(
      updateProjectInvoice(
        { tenantId, projectId, invoiceId, updates: { status: 'void' } },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });

    dependencies.findInvoiceById.mockResolvedValue(record);
    dependencies.updateInvoiceById.mockResolvedValue(null);
    await expect(
      updateProjectInvoice(
        { tenantId, projectId, invoiceId, updates: { status: 'void' } },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });

    const failure = new Error('repository failure');
    dependencies.findProjectById.mockRejectedValue(failure);
    await expect(
      listProjectInvoices({ tenantId, projectId, page: 1, limit: 20 }, dependencies),
    ).rejects.toBe(failure);
  });

  it('requires trusted tenant context, does not mutate records, and performs no logging', async () => {
    const snapshot = { ...record };
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(
      getProjectInvoice({ tenantId: ' ', projectId, invoiceId }, dependencies),
    ).rejects.toBeInstanceOf(TypeError);
    await getProjectInvoice({ tenantId, projectId, invoiceId }, dependencies);
    expect(record).toEqual(snapshot);
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});
