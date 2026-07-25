import { describe, expect, it } from 'vitest';
import {
  dateInputToIso,
  formatInvoiceDate,
  isDueDateOnOrAfterIssueDate,
  toDateInputValue,
} from './invoice-date.js';

describe('Invoice date helpers', () => {
  it('round trips a date-only value without a visible day shift', () => {
    expect(toDateInputValue('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
    expect(dateInputToIso('2026-08-01')).toBe('2026-08-01T00:00:00.000Z');
    expect(formatInvoiceDate('2026-08-01T00:00:00.000Z')).toBe('Aug 1, 2026');
  });

  it('returns safe values for missing and invalid dates', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
    expect(dateInputToIso('2026-02-30')).toBe('');
    expect(formatInvoiceDate('not-a-date')).toBe('Date unavailable');
    expect(formatInvoiceDate('not-a-date')).not.toContain('Invalid Date');
  });

  it('compares valid date-only values and permits equality and past dates', () => {
    expect(isDueDateOnOrAfterIssueDate('2020-01-01', '2020-01-01')).toBe(true);
    expect(isDueDateOnOrAfterIssueDate('2020-01-01', '2020-01-02')).toBe(true);
    expect(isDueDateOnOrAfterIssueDate('2020-01-02', '2020-01-01')).toBe(false);
  });
});
