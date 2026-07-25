import { describe, expect, it } from 'vitest';

import {
  INVOICE_CURRENCY,
  INVOICE_LIMITS,
  INVOICE_STATUS,
} from '../../../src/modules/invoices/invoice.constants.js';

describe('Invoice constants', () => {
  it('defines exactly the frozen supported statuses without overdue or partial payment', () => {
    expect(Object.isFrozen(INVOICE_STATUS)).toBe(true);
    expect(INVOICE_STATUS).toEqual({
      DRAFT: 'draft',
      SENT: 'sent',
      PAID: 'paid',
      VOID: 'void',
    });
    expect(Object.values(INVOICE_STATUS)).toEqual(['draft', 'sent', 'paid', 'void']);
    expect(INVOICE_STATUS).not.toHaveProperty('OVERDUE');
    expect(INVOICE_STATUS).not.toHaveProperty('PARTIALLY_PAID');
  });

  it('defines USD as the only frozen currency', () => {
    expect(Object.isFrozen(INVOICE_CURRENCY)).toBe(true);
    expect(INVOICE_CURRENCY).toEqual({ USD: 'USD' });
  });

  it('defines the frozen Invoice limits once', () => {
    expect(Object.isFrozen(INVOICE_LIMITS)).toBe(true);
    expect(INVOICE_LIMITS).toEqual({
      MIN_AMOUNT_CENTS: 1,
      MAX_AMOUNT_CENTS: 1000000000,
      MAX_INVOICE_NUMBER_LENGTH: 50,
      MAX_NOTES_LENGTH: 2000,
    });
  });
});
