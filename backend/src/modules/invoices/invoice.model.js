import mongoose from 'mongoose';

import { INVOICE_CURRENCY, INVOICE_LIMITS, INVOICE_STATUS } from './invoice.constants.js';

const invoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Tenant ID is required.'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required.'],
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required.'],
      trim: true,
      minlength: [1, 'Invoice number is required.'],
      maxlength: [
        INVOICE_LIMITS.MAX_INVOICE_NUMBER_LENGTH,
        'Invoice number exceeds the allowed maximum length.',
      ],
    },
    amountCents: {
      type: Number,
      required: [true, 'Invoice amount is required.'],
      min: [INVOICE_LIMITS.MIN_AMOUNT_CENTS, 'Invoice amount is below the allowed minimum.'],
      max: [INVOICE_LIMITS.MAX_AMOUNT_CENTS, 'Invoice amount exceeds the allowed maximum.'],
      validate: {
        validator: Number.isInteger,
        message: 'Invoice amount must be an integer number of cents.',
      },
    },
    currency: {
      type: String,
      required: [true, 'Invoice currency is required.'],
      enum: {
        values: Object.values(INVOICE_CURRENCY),
        message: 'Invoice currency is invalid.',
      },
      default: INVOICE_CURRENCY.USD,
    },
    issueDate: {
      type: Date,
      required: [true, 'Invoice issue date is required.'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Invoice due date is required.'],
    },
    status: {
      type: String,
      required: [true, 'Invoice status is required.'],
      enum: {
        values: Object.values(INVOICE_STATUS),
        message: 'Invoice status is invalid.',
      },
      default: INVOICE_STATUS.DRAFT,
    },
    notes: {
      type: String,
      trim: true,
      set: (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined),
      maxlength: [
        INVOICE_LIMITS.MAX_NOTES_LENGTH,
        'Invoice notes exceed the allowed maximum length.',
      ],
      default: undefined,
    },
  },
  {
    collection: 'invoices',
    timestamps: true,
    versionKey: false,
    strict: 'throw',
  },
);

invoiceSchema.index(
  { tenantId: 1, projectId: 1, createdAt: -1 },
  { name: 'idx_invoices_tenant_project_created_at' },
);
invoiceSchema.index(
  { tenantId: 1, projectId: 1, status: 1, createdAt: -1 },
  { name: 'idx_invoices_tenant_project_status_created_at' },
);

export const Invoice = mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema);
