import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { INVOICE_LIMITS, INVOICE_STATUS } from '../../../src/modules/invoices/invoice.constants.js';
import { Invoice } from '../../../src/modules/invoices/invoice.model.js';

const validInput = () => ({
  tenantId: new mongoose.Types.ObjectId(),
  projectId: new mongoose.Types.ObjectId(),
  invoiceNumber: ' INV-1001 ',
  amountCents: 125000,
  issueDate: new Date('2026-08-01T00:00:00.000Z'),
  dueDate: new Date('2026-08-31T00:00:00.000Z'),
  notes: ' Project delivery ',
});

describe('Invoice model', () => {
  it('registers the Invoice model and collection without connecting', () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    expect(Invoice.prototype).toBeInstanceOf(mongoose.Model);
    expect(Invoice.modelName).toBe('Invoice');
    expect(Invoice.collection.collectionName).toBe('invoices');
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });

  it('validates and normalizes a valid Invoice offline with defaults', async () => {
    const invoice = new Invoice(validInput());
    await expect(invoice.validate()).resolves.toBeUndefined();
    expect(invoice.invoiceNumber).toBe('INV-1001');
    expect(invoice.notes).toBe('Project delivery');
    expect(invoice.currency).toBe('USD');
    expect(invoice.status).toBe('draft');
    expect(mongoose.connection.readyState).toBe(0);
  });

  it.each(['tenantId', 'projectId', 'invoiceNumber', 'amountCents', 'issueDate', 'dueDate'])(
    'requires %s',
    async (field) => {
      const input = validInput();
      delete input[field];
      await expect(new Invoice(input).validate()).rejects.toThrow();
    },
  );

  it('uses the required Organization and Project string references', () => {
    expect(Invoice.schema.path('tenantId').options.ref).toBe('Organization');
    expect(Invoice.schema.path('projectId').options.ref).toBe('Project');
  });

  it('enforces Invoice number trimming, non-blank content, and maximum length', async () => {
    await expect(
      new Invoice({ ...validInput(), invoiceNumber: '   ' }).validate(),
    ).rejects.toThrow();
    await expect(
      new Invoice({
        ...validInput(),
        invoiceNumber: 'a'.repeat(INVOICE_LIMITS.MAX_INVOICE_NUMBER_LENGTH + 1),
      }).validate(),
    ).rejects.toThrow();
  });

  it('requires an integer amount within the cent limits', async () => {
    for (const amountCents of [
      1.5,
      INVOICE_LIMITS.MIN_AMOUNT_CENTS - 1,
      INVOICE_LIMITS.MAX_AMOUNT_CENTS + 1,
    ]) {
      await expect(new Invoice({ ...validInput(), amountCents }).validate()).rejects.toThrow();
    }
    await expect(
      new Invoice({
        ...validInput(),
        amountCents: INVOICE_LIMITS.MAX_AMOUNT_CENTS,
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it('accepts only USD and all four supported statuses', async () => {
    await expect(new Invoice({ ...validInput(), currency: 'EUR' }).validate()).rejects.toThrow();
    for (const status of Object.values(INVOICE_STATUS)) {
      await expect(new Invoice({ ...validInput(), status }).validate()).resolves.toBeUndefined();
    }
    await expect(new Invoice({ ...validInput(), status: 'overdue' }).validate()).rejects.toThrow();
  });

  it('accepts valid dates and rejects invalid date casts', async () => {
    await expect(
      new Invoice({ ...validInput(), issueDate: '2026-08-01', dueDate: '2026-08-31' }).validate(),
    ).resolves.toBeUndefined();
    await expect(
      new Invoice({ ...validInput(), issueDate: 'invalid' }).validate(),
    ).rejects.toThrow();
    await expect(new Invoice({ ...validInput(), dueDate: 'invalid' }).validate()).rejects.toThrow();
  });

  it('keeps notes optional, trims them, and enforces the maximum', async () => {
    const absent = new Invoice({ ...validInput(), notes: undefined });
    const blank = new Invoice({ ...validInput(), notes: '   ' });
    await expect(absent.validate()).resolves.toBeUndefined();
    await expect(blank.validate()).resolves.toBeUndefined();
    expect(absent.notes).toBeUndefined();
    expect(blank.notes).toBeUndefined();
    await expect(
      new Invoice({
        ...validInput(),
        notes: 'a'.repeat(INVOICE_LIMITS.MAX_NOTES_LENGTH + 1),
      }).validate(),
    ).rejects.toThrow();
  });

  it('uses timestamps, no version key, throwing strict mode, and exactly the business fields', () => {
    expect(Invoice.schema.options.timestamps).toBe(true);
    expect(Invoice.schema.options.versionKey).toBe(false);
    expect(Invoice.schema.options.strict).toBe('throw');
    expect(Invoice.schema.path('createdAt')).toBeDefined();
    expect(Invoice.schema.path('updatedAt')).toBeDefined();
    expect(() => new Invoice({ ...validInput(), lineItems: [] })).toThrow();
    for (const field of [
      'clientId',
      'lineItems',
      'tax',
      'paymentId',
      'paymentMethod',
      'paidAt',
      'sentAt',
      'overdueAt',
      'deletedAt',
    ]) {
      expect(Invoice.schema.path(field)).toBeUndefined();
    }
  });

  it('defines exactly the two required explicit indexes', () => {
    expect(Invoice.schema.indexes()).toEqual([
      [
        { tenantId: 1, projectId: 1, createdAt: -1 },
        { name: 'idx_invoices_tenant_project_created_at' },
      ],
      [
        { tenantId: 1, projectId: 1, status: 1, createdAt: -1 },
        { name: 'idx_invoices_tenant_project_status_created_at' },
      ],
    ]);
  });
});
