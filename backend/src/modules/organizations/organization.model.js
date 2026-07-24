import mongoose from 'mongoose';

import { ORGANIZATION_PLAN, ORGANIZATION_STATUS } from './organization.constants.js';

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required.'],
      trim: true,
      minlength: [2, 'Organization name must contain at least 2 characters.'],
      maxlength: [120, 'Organization name must contain at most 120 characters.'],
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required.'],
      trim: true,
      lowercase: true,
      minlength: [2, 'Organization slug must contain at least 2 characters.'],
      maxlength: [80, 'Organization slug must contain at most 80 characters.'],
      match: [
        ORGANIZATION_SLUG_PATTERN,
        'Organization slug must contain lowercase letters, numbers, and single hyphens.',
      ],
    },
    status: {
      type: String,
      required: [true, 'Organization status is required.'],
      enum: {
        values: Object.values(ORGANIZATION_STATUS),
        message: 'Organization status is invalid.',
      },
      default: ORGANIZATION_STATUS.ACTIVE,
    },
    plan: {
      type: String,
      required: [true, 'Organization plan is required.'],
      enum: {
        values: Object.values(ORGANIZATION_PLAN),
        message: 'Organization plan is invalid.',
      },
      default: ORGANIZATION_PLAN.FREE,
    },
  },
  {
    collection: 'organizations',
    timestamps: true,
    versionKey: false,
    strict: 'throw',
  },
);

organizationSchema.index(
  {
    slug: 1,
  },
  {
    unique: true,
    name: 'uniq_organizations_slug',
  },
);

export const Organization =
  mongoose.models.Organization ?? mongoose.model('Organization', organizationSchema);
