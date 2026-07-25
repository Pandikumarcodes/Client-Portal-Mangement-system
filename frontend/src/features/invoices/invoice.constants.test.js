import { describe, expect, it } from 'vitest';
import {
  INVOICE_CURRENCY,
  INVOICE_LIMITS,
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_OPTIONS,
} from './invoice.constants.js';

describe('Invoice constants', () => {
  it('defines exactly the four supported statuses and readable labels', () => {
    expect(INVOICE_STATUS).toEqual({
      DRAFT: 'draft',
      SENT: 'sent',
      PAID: 'paid',
      VOID: 'void',
    });
    expect(INVOICE_STATUS_OPTIONS.map(({ value }) => value)).toEqual([
      'draft', 'sent', 'paid', 'void',
    ]);
    expect(INVOICE_STATUS_LABELS).toEqual({
      draft: 'Draft',
      sent: 'Sent',
      paid: 'Paid',
      void: 'Void',
    });
    expect(Object.values(INVOICE_STATUS)).not.toContain('overdue');
  });

  it('defines only USD and the backend limits', () => {
    expect(INVOICE_CURRENCY).toEqual({ USD: 'USD' });
    expect(INVOICE_LIMITS).toEqual({
      MIN_AMOUNT_CENTS: 1,
      MAX_AMOUNT_CENTS: 1000000000,
      MAX_INVOICE_NUMBER_LENGTH: 50,
      MAX_NOTES_LENGTH: 2000,
    });
  });

  it('protects definitions from mutation', () => {
    expect(Object.isFrozen(INVOICE_STATUS)).toBe(true);
    expect(Object.isFrozen(INVOICE_STATUS_OPTIONS)).toBe(true);
    expect(INVOICE_STATUS_OPTIONS.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(INVOICE_STATUS_LABELS)).toBe(true);
    expect(Object.isFrozen(INVOICE_CURRENCY)).toBe(true);
    expect(Object.isFrozen(INVOICE_LIMITS)).toBe(true);
  });
});
