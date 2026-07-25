export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  VOID: 'void',
});

export const INVOICE_CURRENCY = Object.freeze({
  USD: 'USD',
});

export const INVOICE_LIMITS = Object.freeze({
  MIN_AMOUNT_CENTS: 1,
  MAX_AMOUNT_CENTS: 1000000000,
  MAX_INVOICE_NUMBER_LENGTH: 50,
  MAX_NOTES_LENGTH: 2000,
});
