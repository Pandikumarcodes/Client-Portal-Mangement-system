import { INVOICE_LIMITS } from './invoice.constants.js';

const USD_AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function parseUsdAmountToCents(value) {
  if (typeof value !== 'string') return null;
  const match = USD_AMOUNT_PATTERN.exec(value.trim());
  if (!match) return null;
  const wholeCents = Number(match[1]) * 100;
  const fractionalCents = Number((match[2] ?? '').padEnd(2, '0'));
  const amountCents = wholeCents + fractionalCents;
  if (
    !Number.isSafeInteger(amountCents)
    || amountCents < INVOICE_LIMITS.MIN_AMOUNT_CENTS
    || amountCents > INVOICE_LIMITS.MAX_AMOUNT_CENTS
  ) {
    return null;
  }
  return amountCents;
}

export function formatCentsAsUsd(amountCents) {
  if (
    !Number.isInteger(amountCents)
    || amountCents < INVOICE_LIMITS.MIN_AMOUNT_CENTS
    || amountCents > INVOICE_LIMITS.MAX_AMOUNT_CENTS
  ) {
    return 'Amount unavailable';
  }
  return usdFormatter.format(amountCents / 100);
}

export function formatCentsForInput(amountCents) {
  if (
    !Number.isInteger(amountCents)
    || amountCents < INVOICE_LIMITS.MIN_AMOUNT_CENTS
    || amountCents > INVOICE_LIMITS.MAX_AMOUNT_CENTS
  ) {
    return '';
  }
  const whole = Math.floor(amountCents / 100);
  const fraction = String(amountCents % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}
