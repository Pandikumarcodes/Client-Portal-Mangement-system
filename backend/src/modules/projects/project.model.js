import mongoose from 'mongoose';

import { PROJECT_STATUS } from './project.constants.js';

const projectSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Tenant ID is required.'],
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client ID is required.'],
    },
    name: {
      type: String,
      required: [true, 'Project name is required.'],
      trim: true,
      minlength: [2, 'Project name must contain at least 2 characters.'],
      maxlength: [150, 'Project name must contain at most 150 characters.'],
    },
    description: {
      type: String,
      trim: true,
      set: (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined),
      maxlength: [2000, 'Project description must contain at most 2000 characters.'],
      default: undefined,
    },
    status: {
      type: String,
      required: [true, 'Project status is required.'],
      enum: {
        values: Object.values(PROJECT_STATUS),
        message: 'Project status is invalid.',
      },
      default: PROJECT_STATUS.ACTIVE,
    },
  },
  {
    collection: 'projects',
    timestamps: true,
    versionKey: false,
    strict: 'throw',
  },
);

projectSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'idx_projects_tenant_created_at' });
projectSchema.index(
  { tenantId: 1, clientId: 1, createdAt: -1 },
  { name: 'idx_projects_tenant_client_created_at' },
);

export const Project = mongoose.models.Project ?? mongoose.model('Project', projectSchema);
