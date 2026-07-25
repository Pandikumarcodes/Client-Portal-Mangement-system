import { describe, expect, it } from 'vitest';
import {
  formatCentsAsUsd,
  formatCentsForInput,
  parseUsdAmountToCents,
} from './invoice-format.js';

describe('parseUsdAmountToCents', () => {
  it.each([
    ['0.01', 1],
    ['1', 100],
    ['1.5', 150],
    ['1.50', 150],
    ['1250.00', 125000],
    [' 1.50 ', 150],
    ['10000000.00', 1000000000],
  ])('converts %j deterministically to %i integer cents', (value, expected) => {
    const result = parseUsdAmountToCents(value);
    expect(result).toBe(expected);
    expect(Number.isInteger(result)).toBe(true);
  });

  it.each([
    '', '0', '0.00', '-1', '1.001', 'abc', '$1.00', '1,000.00', '1e3',
    '.01', '10000000.01',
  ])('rejects unsupported input %j', (value) => {
    expect(parseUsdAmountToCents(value)).toBeNull();
  });
});

describe('formatCentsAsUsd', () => {
  it.each([
    [1, '$0.01'],
    [100, '$1.00'],
    [125000, '$1,250.00'],
    [1000000000, '$10,000,000.00'],
  ])('formats %i cents as %s', (value, expected) => {
    expect(formatCentsAsUsd(value)).toBe(expected);
  });

  it.each([null, undefined, NaN, -1, 0, 1.5, 1000000001])(
    'uses a neutral fallback for %j',
    (value) => {
      expect(formatCentsAsUsd(value)).toBe('Amount unavailable');
      expect(formatCentsAsUsd(value)).not.toContain('NaN');
    },
  );
});

describe('formatCentsForInput', () => {
  it.each([
    [1, '0.01'],
    [100, '1.00'],
    [125000, '1250.00'],
  ])('formats %i without locale separators', (value, expected) => {
    expect(formatCentsForInput(value)).toBe(expected);
    expect(formatCentsForInput(value)).not.toContain(',');
  });
  it.each([null, NaN, 0, -1, 1.5])('returns an empty value for %j', (value) => {
    expect(formatCentsForInput(value)).toBe('');
  });
});
