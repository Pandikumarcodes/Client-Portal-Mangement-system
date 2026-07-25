import { describe, expect, it } from 'vitest';
import {
  dateInputToIso,
  isValidDateInput,
  toDateInputValue,
} from './milestone-date.js';

describe('Milestone date-only conversion', () => {
  it('extracts the API calendar date without a timezone shift', () => {
    expect(toDateInputValue('2026-08-15T00:00:00.000Z')).toBe('2026-08-15');
    expect(toDateInputValue(dateInputToIso('2026-08-15'))).toBe('2026-08-15');
  });

  it('returns safe empty values for missing or invalid API dates', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
    expect(toDateInputValue('2026-02-30T00:00:00.000Z')).toBe('');
  });

  it('accepts past dates and converts valid input to UTC midnight', () => {
    expect(isValidDateInput('2020-01-02')).toBe(true);
    expect(dateInputToIso('2020-01-02')).toBe('2020-01-02T00:00:00.000Z');
    expect(dateInputToIso('')).toBe('');
    expect(isValidDateInput('2026-13-01')).toBe(false);
  });
});
