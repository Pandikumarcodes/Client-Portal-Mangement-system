import { describe, expect, it } from 'vitest';

import { INVOICE_LIMITS, INVOICE_STATUS } from '../../../src/modules/invoices/invoice.constants.js';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  projectInvoiceParamsSchema,
  projectInvoicesParamsSchema,
  updateInvoiceSchema,
} from '../../../src/modules/invoices/invoice.schemas.js';

const projectId = 'ABCDEFABCDEF123456789012';
const invoiceId = '1234567890ABCDEF12345678';
const validCreate = () => ({
  invoiceNumber: ' INV-1001 ',
  amountCents: 125000,
  issueDate: '2026-08-01',
  dueDate: '2026-08-31T00:00:00.000Z',
});

describe('Invoice schemas', () => {
  it('parses and normalizes a valid create body', () => {
    const result = createInvoiceSchema.parse({ ...validCreate(), notes: ' Delivery ' });
    expect(result).toEqual({
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-31T00:00:00.000Z'),
      notes: 'Delivery',
    });
  });

  it('coerces numeric strings but requires integer cents within limits', () => {
    expect(createInvoiceSchema.parse({ ...validCreate(), amountCents: '1' }).amountCents).toBe(1);
    expect(
      createInvoiceSchema.parse({
        ...validCreate(),
        amountCents: INVOICE_LIMITS.MAX_AMOUNT_CENTS,
      }).amountCents,
    ).toBe(INVOICE_LIMITS.MAX_AMOUNT_CENTS);
    for (const amountCents of [0, 1.5, INVOICE_LIMITS.MAX_AMOUNT_CENTS + 1, '$100.00']) {
      expect(() => createInvoiceSchema.parse({ ...validCreate(), amountCents })).toThrow();
    }
  });

  it('accepts equal/ascending ISO dates and rejects descending or invalid dates', () => {
    expect(() =>
      createInvoiceSchema.parse({
        ...validCreate(),
        issueDate: '2026-08-01',
        dueDate: '2026-08-01',
      }),
    ).not.toThrow();
    expect(() =>
      createInvoiceSchema.parse({
        ...validCreate(),
        issueDate: '2026-08-01T05:30:00+05:30',
        dueDate: '2026-08-02T00:00:00Z',
      }),
    ).not.toThrow();
    expect(() =>
      createInvoiceSchema.parse({
        ...validCreate(),
        issueDate: '2026-08-02',
        dueDate: '2026-08-01',
      }),
    ).toThrow();
    expect(() =>
      createInvoiceSchema.parse({ ...validCreate(), issueDate: 'not-a-date' }),
    ).toThrow();
  });

  it('normalizes blank notes and enforces the notes maximum', () => {
    expect(createInvoiceSchema.parse(validCreate())).not.toHaveProperty('notes');
    expect(createInvoiceSchema.parse({ ...validCreate(), notes: '   ' })).toEqual({
      ...createInvoiceSchema.parse(validCreate()),
      notes: undefined,
    });
    expect(() =>
      createInvoiceSchema.parse({
        ...validCreate(),
        notes: 'a'.repeat(INVOICE_LIMITS.MAX_NOTES_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('rejects all unsupported and trusted create fields', () => {
    for (const [field, value] of [
      ['tenantId', 'private'],
      ['projectId', projectId],
      ['currency', 'USD'],
      ['status', 'draft'],
      ['amount', 100],
      ['lineItems', []],
      ['tax', 10],
      ['paymentId', 'private'],
    ]) {
      expect(() => createInvoiceSchema.parse({ ...validCreate(), [field]: value })).toThrow();
    }
  });

  it('accepts supported partial updates, null notes, and all statuses', () => {
    expect(updateInvoiceSchema.parse({ invoiceNumber: ' INV-2 ' })).toEqual({
      invoiceNumber: 'INV-2',
    });
    expect(updateInvoiceSchema.parse({ notes: null })).toEqual({ notes: null });
    for (const status of Object.values(INVOICE_STATUS)) {
      expect(updateInvoiceSchema.parse({ status })).toEqual({ status });
    }
  });

  it('rejects empty, invalid-status, and immutable updates', () => {
    expect(() => updateInvoiceSchema.parse({})).toThrow();
    expect(() => updateInvoiceSchema.parse({ status: 'overdue' })).toThrow();
    for (const [field, value] of [
      ['tenantId', 'private'],
      ['projectId', projectId],
      ['currency', 'USD'],
      ['amount', 100],
      ['lineItems', []],
      ['subtotal', 100],
      ['tax', 10],
      ['discount', 10],
      ['paymentId', 'private'],
      ['createdAt', '2026-01-01'],
      ['updatedAt', '2026-01-01'],
    ]) {
      expect(() => updateInvoiceSchema.parse({ [field]: value })).toThrow();
    }
  });

  it('validates an update date pair when both dates are supplied', () => {
    expect(() =>
      updateInvoiceSchema.parse({
        issueDate: '2026-08-01',
        dueDate: '2026-08-31',
      }),
    ).not.toThrow();
    expect(() =>
      updateInvoiceSchema.parse({
        issueDate: '2026-09-01',
        dueDate: '2026-08-31',
      }),
    ).toThrow();
  });

  it('normalizes valid nested params and rejects invalid or unknown params safely', () => {
    expect(projectInvoicesParamsSchema.parse({ projectId })).toEqual({
      projectId: projectId.toLowerCase(),
    });
    expect(projectInvoiceParamsSchema.parse({ projectId, invoiceId })).toEqual({
      projectId: projectId.toLowerCase(),
      invoiceId: invoiceId.toLowerCase(),
    });
    expect(() => projectInvoicesParamsSchema.parse({ projectId: 'invalid' })).toThrow();
    expect(() => projectInvoiceParamsSchema.parse({ projectId, invoiceId: 'invalid' })).toThrow();
    expect(() => projectInvoicesParamsSchema.parse({ projectId, tenantId: 'private' })).toThrow();
  });

  it('defaults/coerces pagination, accepts status, and rejects unsupported query fields', () => {
    expect(listInvoicesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(listInvoicesQuerySchema.parse({ page: '2', limit: '5', status: 'paid' })).toEqual({
      page: 2,
      limit: 5,
      status: 'paid',
    });
    expect(() => listInvoicesQuerySchema.parse({ limit: '51' })).toThrow();
    expect(() => listInvoicesQuerySchema.parse({ status: 'overdue' })).toThrow();
    for (const field of ['tenantId', 'projectId', 'search', 'amountCents', 'sort']) {
      expect(() => listInvoicesQuerySchema.parse({ [field]: 'private' })).toThrow();
    }
  });

  it('never repeats submitted values in validation messages', () => {
    const privateValue = 'private-invalid-invoice-identifier';
    const params = projectInvoiceParamsSchema.safeParse({ projectId, invoiceId: privateValue });
    const body = createInvoiceSchema.safeParse({
      ...validCreate(),
      issueDate: privateValue,
    });
    expect(params.success).toBe(false);
    expect(body.success).toBe(false);
    expect(JSON.stringify([params.error.issues, body.error.issues])).not.toContain(privateValue);
  });
});
