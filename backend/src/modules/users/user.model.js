import mongoose from 'mongoose';

import { USER_ROLE, USER_STATUS } from './user.constants.js';

const USER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [
        function isTenantOwnedUser() {
          return this.role !== USER_ROLE.SUPER_ADMIN;
        },
        'Tenant ID is required for organization users.',
      ],
      validate: {
        validator(value) {
          return this.role !== USER_ROLE.SUPER_ADMIN || value === undefined;
        },
        message: 'Super Admin users cannot have a tenant ID.',
      },
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
      match: [USER_EMAIL_PATTERN, 'Email format is invalid.'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required.'],
      minlength: [20, 'Password hash must contain at least 20 characters.'],
      maxlength: [255, 'Password hash must contain at most 255 characters.'],
      select: false,
    },
    role: {
      type: String,
      required: [true, 'User role is required.'],
      enum: {
        values: Object.values(USER_ROLE),
        message: 'User role is invalid.',
      },
    },
    status: {
      type: String,
      required: [true, 'User status is required.'],
      enum: {
        values: Object.values(USER_STATUS),
        message: 'User status is invalid.',
      },
      default: USER_STATUS.ACTIVE,
    },
  },
  {
    collection: 'users',
    timestamps: true,
    versionKey: false,
    strict: 'throw',
  },
);

userSchema.index(
  {
    email: 1,
  },
  {
    unique: true,
    name: 'uniq_users_email',
  },
);

userSchema.index(
  {
    tenantId: 1,
  },
  {
    name: 'idx_users_tenant_id',
  },
);

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
