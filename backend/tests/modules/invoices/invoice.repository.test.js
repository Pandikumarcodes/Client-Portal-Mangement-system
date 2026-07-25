import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  Invoice: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../../src/modules/invoices/invoice.model.js', () => ({ Invoice: mocks.Invoice }));

const { createInvoice, findInvoiceById, findInvoices, updateInvoiceById } =
  await import('../../../src/modules/invoices/invoice.repository.js');

const record = { _id: 'invoice-id' };
const queryWithLean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Invoice repository', () => {
  it('creates one tenant- and Project-scoped record without forcing defaults or unsupported fields', async () => {
    mocks.Invoice.create.mockResolvedValue(record);
    const input = {
      tenantId: 'tenant-id',
      projectId: 'project-id',
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: new Date('2026-08-01T00:00:00Z'),
      dueDate: new Date('2026-08-31T00:00:00Z'),
      notes: undefined,
    };
    await expect(createInvoice(input)).resolves.toBe(record);
    expect(mocks.Invoice.create).toHaveBeenCalledWith(input);
    expect(mocks.Invoice.create.mock.calls[0][0]).not.toHaveProperty('currency');
    expect(mocks.Invoice.create.mock.calls[0][0]).not.toHaveProperty('status');
    expect(mocks.Invoice.create.mock.calls[0][0]).not.toHaveProperty('lineItems');
  });

  it('lists and counts with one identical tenant/Project/status filter and pagination', async () => {
    const lean = vi.fn().mockResolvedValue([record]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    mocks.Invoice.find.mockReturnValue({ sort });
    mocks.Invoice.countDocuments.mockResolvedValue(5);

    await expect(
      findInvoices({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        page: 2,
        limit: 2,
        status: 'paid',
      }),
    ).resolves.toEqual({ invoices: [record], total: 5 });
    const filter = { tenantId: 'tenant-id', projectId: 'project-id', status: 'paid' };
    expect(mocks.Invoice.find).toHaveBeenCalledWith(filter);
    expect(mocks.Invoice.countDocuments).toHaveBeenCalledWith(filter);
    expect(mocks.Invoice.find.mock.calls[0][0]).toBe(mocks.Invoice.countDocuments.mock.calls[0][0]);
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(2);
    expect(limit).toHaveBeenCalledWith(2);
    expect(lean).toHaveBeenCalledOnce();
  });

  it('always includes tenantId and projectId when status is absent', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ lean }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    mocks.Invoice.find.mockReturnValue({ sort });
    mocks.Invoice.countDocuments.mockResolvedValue(0);
    await findInvoices({
      tenantId: 'tenant-id',
      projectId: 'project-id',
      page: 1,
      limit: 20,
    });
    expect(mocks.Invoice.find).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      projectId: 'project-id',
    });
  });

  it('finds one Invoice only by _id, tenantId, and projectId', async () => {
    mocks.Invoice.findOne.mockReturnValue(queryWithLean(null));
    await expect(
      findInvoiceById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        invoiceId: 'invoice-id',
      }),
    ).resolves.toBeNull();
    expect(mocks.Invoice.findOne).toHaveBeenCalledWith({
      _id: 'invoice-id',
      tenantId: 'tenant-id',
      projectId: 'project-id',
    });
  });

  it('updates only allowed fields using scoped matching and validators', async () => {
    mocks.Invoice.findOneAndUpdate.mockReturnValue(queryWithLean(record));
    await expect(
      updateInvoiceById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        invoiceId: 'invoice-id',
        updates: {
          invoiceNumber: 'INV-2',
          amountCents: 200,
          issueDate: new Date('2026-08-02'),
          dueDate: new Date('2026-08-03'),
          status: 'paid',
          notes: undefined,
          tenantId: 'attacker',
          projectId: 'attacker-project',
          currency: 'EUR',
          paymentId: 'private',
          lineItems: [],
        },
      }),
    ).resolves.toBe(record);
    expect(mocks.Invoice.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'invoice-id', tenantId: 'tenant-id', projectId: 'project-id' },
      {
        $unset: { notes: 1 },
        $set: {
          invoiceNumber: 'INV-2',
          amountCents: 200,
          issueDate: new Date('2026-08-02'),
          dueDate: new Date('2026-08-03'),
          status: 'paid',
        },
      },
      { new: true, runValidators: true },
    );
  });

  it('returns missing results without connecting or verifying Project ownership', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    mocks.Invoice.findOneAndUpdate.mockReturnValue(queryWithLean(null));
    await expect(
      updateInvoiceById({
        tenantId: 'tenant-id',
        projectId: 'project-id',
        invoiceId: 'missing',
        updates: { status: 'void' },
      }),
    ).resolves.toBeNull();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(mocks.Invoice.findOne).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });
});
