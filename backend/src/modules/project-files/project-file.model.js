import mongoose from 'mongoose';

import {
  ALLOWED_PROJECT_FILE_TYPES,
  PROJECT_FILE_LIMITS,
  PROJECT_FILE_STATUS,
} from './project-file.constants.js';

const projectFileSchema = new mongoose.Schema(
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
    originalName: {
      type: String,
      required: [true, 'Original name is required.'],
      trim: true,
      minlength: [1, 'Original name is required.'],
      maxlength: [255, 'Original name must contain at most 255 characters.'],
    },
    storedName: {
      type: String,
      required: [true, 'Stored name is required.'],
      trim: true,
      minlength: [1, 'Stored name is required.'],
      maxlength: [255, 'Stored name must contain at most 255 characters.'],
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required.'],
      trim: true,
      minlength: [1, 'Storage path is required.'],
      maxlength: [1000, 'Storage path must contain at most 1000 characters.'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required.'],
      enum: {
        values: ALLOWED_PROJECT_FILE_TYPES,
        message: 'MIME type is invalid.',
      },
    },
    sizeBytes: {
      type: Number,
      required: [true, 'File size is required.'],
      min: [1, 'File size must be positive.'],
      max: [PROJECT_FILE_LIMITS.MAX_FILE_SIZE_BYTES, 'File size exceeds the allowed maximum.'],
      validate: {
        validator: Number.isInteger,
        message: 'File size must be an integer.',
      },
    },
    description: {
      type: String,
      trim: true,
      set: (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined),
      maxlength: [500, 'Description must contain at most 500 characters.'],
      default: undefined,
    },
    status: {
      type: String,
      required: [true, 'Project File status is required.'],
      enum: {
        values: Object.values(PROJECT_FILE_STATUS),
        message: 'Project File status is invalid.',
      },
      default: PROJECT_FILE_STATUS.ACTIVE,
    },
  },
  {
    collection: 'project_files',
    timestamps: true,
    versionKey: false,
    strict: 'throw',
  },
);

projectFileSchema.index(
  { tenantId: 1, projectId: 1, createdAt: -1 },
  { name: 'idx_project_files_tenant_project_created_at' },
);
projectFileSchema.index(
  { tenantId: 1, projectId: 1, status: 1, createdAt: -1 },
  { name: 'idx_project_files_tenant_project_status_created_at' },
);

export const ProjectFile =
  mongoose.models.ProjectFile ?? mongoose.model('ProjectFile', projectFileSchema);
