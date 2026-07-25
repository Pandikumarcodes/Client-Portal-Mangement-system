import mongoose from 'mongoose';

import { CLIENT_STATUS } from './client.constants.js';

const CLIENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clientSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Tenant ID is required.'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required.'],
      trim: true,
      minlength: [1, 'First name must contain at least 1 character.'],
      maxlength: [80, 'First name must contain at most 80 characters.'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required.'],
      trim: true,
      minlength: [1, 'Last name must contain at least 1 character.'],
      maxlength: [80, 'Last name must contain at most 80 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email must contain at most 254 characters.'],
      match: [CLIENT_EMAIL_PATTERN, 'Email format is invalid.'],
    },
    companyName: {
      type: String,
      trim: true,
      set: (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined),
      maxlength: [120, 'Company name must contain at most 120 characters.'],
      default: undefined,
    },
    status: {
      type: String,
      required: [true, 'Client status is required.'],
      enum: {
        values: Object.values(CLIENT_STATUS),
        message: 'Client status is invalid.',
      },
      default: CLIENT_STATUS.ACTIVE,
    },
  },
  {
    collection: 'clients',
    timestamps: true,
    versionKey: false,
    strict: 'throw',
  },
);

clientSchema.index({ tenantId: 1, email: 1 }, { unique: true, name: 'uniq_clients_tenant_email' });
clientSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'idx_clients_tenant_created_at' });
clientSchema.index({ userId: 1 }, { unique: true, sparse: true, name: 'uniq_clients_user_id' });

export const Client = mongoose.models.Client ?? mongoose.model('Client', clientSchema);
