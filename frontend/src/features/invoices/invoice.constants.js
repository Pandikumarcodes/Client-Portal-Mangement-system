export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  VOID: 'void',
});

export const INVOICE_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: INVOICE_STATUS.DRAFT, label: 'Draft' }),
  Object.freeze({ value: INVOICE_STATUS.SENT, label: 'Sent' }),
  Object.freeze({ value: INVOICE_STATUS.PAID, label: 'Paid' }),
  Object.freeze({ value: INVOICE_STATUS.VOID, label: 'Void' }),
]);

export const INVOICE_STATUS_LABELS = Object.freeze(
  Object.fromEntries(INVOICE_STATUS_OPTIONS.map(({ value, label }) => [value, label])),
);

export const INVOICE_CURRENCY = Object.freeze({ USD: 'USD' });

export const INVOICE_LIMITS = Object.freeze({
  MIN_AMOUNT_CENTS: 1,
  MAX_AMOUNT_CENTS: 1000000000,
  MAX_INVOICE_NUMBER_LENGTH: 50,
  MAX_NOTES_LENGTH: 2000,
});

export const INVOICE_PAGE_SIZE = 20;
