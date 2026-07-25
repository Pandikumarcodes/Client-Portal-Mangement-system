import { z } from 'zod';

import { INVOICE_LIMITS, INVOICE_STATUS } from './invoice.constants.js';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'ID is invalid.')
  .transform((value) => value.toLowerCase());
const invoiceNumber = z
  .string()
  .trim()
  .min(1, 'Invoice number is required.')
  .max(
    INVOICE_LIMITS.MAX_INVOICE_NUMBER_LENGTH,
    'Invoice number exceeds the allowed maximum length.',
  );
const amountCents = z.coerce
  .number()
  .int('Invoice amount must be an integer number of cents.')
  .min(INVOICE_LIMITS.MIN_AMOUNT_CENTS, 'Invoice amount is below the allowed minimum.')
  .max(INVOICE_LIMITS.MAX_AMOUNT_CENTS, 'Invoice amount exceeds the allowed maximum.');
const isoDate = z
  .union([
    z.iso.date({ message: 'Invoice date is invalid.' }),
    z.iso.datetime({
      offset: true,
      local: true,
      message: 'Invoice date is invalid.',
    }),
  ])
  .transform((value) => new Date(value));
const notes = z
  .string()
  .trim()
  .max(INVOICE_LIMITS.MAX_NOTES_LENGTH, 'Invoice notes exceed the allowed maximum length.')
  .transform((value) => value || undefined);
const hasValidDateRange = ({ issueDate, dueDate }) =>
  issueDate === undefined || dueDate === undefined || dueDate.getTime() >= issueDate.getTime();
const dateRangeRefinement = {
  message: 'The due date must be on or after the issue date.',
  path: ['dueDate'],
};

export const createInvoiceSchema = z
  .object({
    invoiceNumber,
    amountCents,
    issueDate: isoDate,
    dueDate: isoDate,
    notes: notes.optional(),
  })
  .strict()
  .refine(hasValidDateRange, dateRangeRefinement);

export const updateInvoiceSchema = z
  .object({
    invoiceNumber: invoiceNumber.optional(),
    amountCents: amountCents.optional(),
    issueDate: isoDate.optional(),
    dueDate: isoDate.optional(),
    status: z
      .enum(Object.values(INVOICE_STATUS), { message: 'Invoice status is invalid.' })
      .optional(),
    notes: notes.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one Invoice field is required.',
  })
  .refine(hasValidDateRange, dateRangeRefinement);

export const projectInvoicesParamsSchema = z.object({ projectId: objectId }).strict();

export const projectInvoiceParamsSchema = z
  .object({
    projectId: objectId,
    invoiceId: objectId,
  })
  .strict();

export const listInvoicesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z
      .enum(Object.values(INVOICE_STATUS), { message: 'Invoice status is invalid.' })
      .optional(),
  })
  .strict();
