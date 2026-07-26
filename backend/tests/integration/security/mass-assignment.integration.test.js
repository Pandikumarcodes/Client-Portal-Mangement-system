import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from '../../../src/modules/auth/auth.schemas.js';
import {
  createClientSchema,
  updateClientSchema,
} from '../../../src/modules/clients/client.schemas.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
} from '../../../src/modules/invoices/invoice.schemas.js';
import {
  updateProjectFileSchema,
  uploadProjectFileFieldsSchema,
} from '../../../src/modules/project-files/project-file.schemas.js';
import {
  createProjectSchema,
  updateProjectSchema,
} from '../../../src/modules/projects/project.schemas.js';
import { updateOrganizationStatusSchema } from '../../../src/modules/super-admin/super-admin.schemas.js';

const forbiddenFields = [
  'tenantId',
  'role',
  'organizationId',
  'userId',
  'passwordHash',
  'refreshTokenHash',
  'createdAt',
  'updatedAt',
];

const cases = [
  [
    'registration',
    registerSchema,
    {
      organizationName: 'Acme',
      organizationSlug: 'acme',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      password: 'StrongPass1',
    },
    forbiddenFields,
  ],
  ['login', loginSchema, { email: 'ada@example.test', password: 'StrongPass1' }, forbiddenFields],
  [
    'Client create',
    createClientSchema,
    { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' },
    [...forbiddenFields, 'status'],
  ],
  ['Client update', updateClientSchema, { firstName: 'Ada' }, forbiddenFields],
  [
    'Project create',
    createProjectSchema,
    { clientId: '507f1f77bcf86cd799439011', name: 'Secure Project' },
    [...forbiddenFields, 'status'],
  ],
  [
    'Project update',
    updateProjectSchema,
    { name: 'Secure Project' },
    [...forbiddenFields, 'projectId'],
  ],
  [
    'Project File upload fields',
    uploadProjectFileFieldsSchema,
    { description: 'Safe' },
    [
      ...forbiddenFields,
      'projectId',
      'storedName',
      'storagePath',
      'mimeType',
      'sizeBytes',
      'status',
    ],
  ],
  [
    'Project File update',
    updateProjectFileSchema,
    { description: 'Safe' },
    [...forbiddenFields, 'projectId', 'storedName', 'storagePath', 'mimeType', 'sizeBytes'],
  ],
  [
    'Invoice create',
    createInvoiceSchema,
    {
      invoiceNumber: 'INV-1',
      amountCents: 100,
      issueDate: '2026-01-01',
      dueDate: '2026-01-02',
    },
    [...forbiddenFields, 'projectId', 'status', 'currency', 'paymentId'],
  ],
  [
    'Invoice update',
    updateInvoiceSchema,
    { invoiceNumber: 'INV-1' },
    [...forbiddenFields, 'projectId', 'currency', 'paymentId'],
  ],
  [
    'Super Admin Organization status',
    updateOrganizationStatusSchema,
    { status: 'suspended' },
    [...forbiddenFields, 'projectId'],
  ],
];

describe('strict request-schema mass-assignment boundary', () => {
  it.each(cases)('rejects forbidden fields for %s', (_name, schema, valid, fields) => {
    expect(schema.safeParse(valid).success).toBe(true);
    for (const field of fields) {
      const parsed = schema.safeParse({ ...valid, [field]: 'attacker-controlled' });
      expect(parsed.success, field).toBe(false);
    }
  });

  it.each([
    ['Client', updateClientSchema],
    ['Project', updateProjectSchema],
    ['Project File', updateProjectFileSchema],
    ['Invoice', updateInvoiceSchema],
  ])('rejects empty %s updates', (_name, schema) => {
    expect(schema.safeParse({}).success).toBe(false);
  });
});
