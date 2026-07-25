import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../src/core/errors/api-error.js';
import { errorHandler } from '../../../src/middlewares/error-handler.js';
import { notFoundHandler } from '../../../src/middlewares/not-found.js';

const tokenMocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn((token) => {
    const identities = {
      'organization-admin-token': {
        userId: 'admin-id',
        role: 'organization_admin',
        tenantId: 'trusted-tenant-id',
        tokenType: 'access',
      },
      'client-token': {
        userId: 'client-id',
        role: 'client',
        tenantId: 'trusted-tenant-id',
        tokenType: 'access',
      },
      'super-admin-token': {
        userId: 'super-id',
        role: 'super_admin',
        tokenType: 'access',
      },
    };
    return identities[token] ?? null;
  }),
}));

vi.mock('../../../src/modules/auth/token.js', () => ({
  verifyAccessToken: tokenMocks.verifyAccessToken,
}));

const { createInvoiceRouter } = await import('../../../src/modules/invoices/invoice.routes.js');

const projectId = '1234567890abcdef12345678';
const invoiceId = 'abcdefabcdef123456789012';
const invoice = {
  id: invoiceId,
  projectId,
  invoiceNumber: 'INV-1001',
  amountCents: 125000,
  currency: 'USD',
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-31T00:00:00.000Z',
  status: 'draft',
  notes: null,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const validBody = {
  invoiceNumber: 'INV-1001',
  amountCents: 125000,
  issueDate: '2026-08-01',
  dueDate: '2026-08-31',
};

const createTestApp = () => {
  const services = {
    createProjectInvoice: vi.fn().mockResolvedValue(invoice),
    listProjectInvoices: vi.fn().mockResolvedValue({
      invoices: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    getProjectInvoice: vi.fn().mockResolvedValue(invoice),
    updateProjectInvoice: vi.fn(async ({ updates }) => ({
      ...invoice,
      ...updates,
      issueDate:
        updates.issueDate instanceof Date ? updates.issueDate.toISOString() : invoice.issueDate,
      dueDate: updates.dueDate instanceof Date ? updates.dueDate.toISOString() : invoice.dueDate,
      notes: updates.notes ?? (updates.notes === null ? null : invoice.notes),
    })),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/v1/projects/:projectId/invoices', createInvoiceRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, services };
};

let testApp;

beforeEach(() => {
  testApp = createTestApp();
  tokenMocks.verifyAccessToken.mockClear();
});

describe('Invoice routes', () => {
  it.each([
    ['post', `/api/v1/projects/${projectId}/invoices`],
    ['get', `/api/v1/projects/${projectId}/invoices`],
  ])('requires authentication before validation for %s', async (method, url) => {
    const response = await request(testApp.app)[method](url);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it.each(['client-token', 'super-admin-token'])('forbids the %s role', async (token) => {
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/invoices`)
      .set(auth(token));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows an Organization Admin to create using validated parent params and body', async () => {
    const response = await request(testApp.app)
      .post(`/api/v1/projects/${projectId.toUpperCase()}/invoices`)
      .set(auth('organization-admin-token'))
      .send({ ...validBody, invoiceNumber: ' INV-1001 ', notes: ' Delivery ' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, data: { invoice } });
    expect(testApp.services.createProjectInvoice).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: new Date('2026-08-01T00:00:00.000Z'),
      dueDate: new Date('2026-08-31T00:00:00.000Z'),
      notes: 'Delivery',
    });
  });

  it.each([
    [{}, 'required fields'],
    [{ ...validBody, tenantId: 'private' }, 'tenantId'],
    [{ ...validBody, projectId }, 'projectId'],
    [{ ...validBody, currency: 'USD' }, 'currency'],
    [{ ...validBody, status: 'draft' }, 'status'],
    [
      {
        invoiceNumber: 'INV',
        amount: 100,
        issueDate: '2026-08-01',
        dueDate: '2026-08-31',
      },
      'amount',
    ],
    [{ ...validBody, lineItems: [] }, 'lineItems'],
  ])('rejects an invalid create body containing %s', async (body) => {
    const response = await request(testApp.app)
      .post(`/api/v1/projects/${projectId}/invoices`)
      .set(auth('organization-admin-token'))
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists with defaults and an accepted status filter', async () => {
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/invoices?status=draft`)
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
    expect(testApp.services.listProjectInvoices).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      page: 1,
      limit: 20,
      status: 'draft',
    });
  });

  it('gets one Invoice using validated IDs', async () => {
    const response = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/invoices/${invoiceId}`)
      .set(auth('organization-admin-token'));
    expect(response.status).toBe(200);
    expect(response.body.data.invoice).toEqual(invoice);
    expect(testApp.services.getProjectInvoice).toHaveBeenCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      invoiceId,
    });
  });

  it('rejects invalid IDs with safe validation errors', async () => {
    const invalidProject = await request(testApp.app)
      .get('/api/v1/projects/private-project/invoices')
      .set(auth('organization-admin-token'));
    const invalidInvoice = await request(testApp.app)
      .get(`/api/v1/projects/${projectId}/invoices/private-invoice`)
      .set(auth('organization-admin-token'));
    expect(invalidProject.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidInvoice.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify([invalidProject.body, invalidInvoice.body])).not.toContain('private-');
  });

  it.each(['sent', 'paid', 'void'])('allows manual status change to %s', async (status) => {
    const response = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`)
      .set(auth('organization-admin-token'))
      .send({ status });
    expect(response.status).toBe(200);
    expect(response.body.data.invoice.status).toBe(status);
    expect(testApp.services.updateProjectInvoice).toHaveBeenLastCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      invoiceId,
      updates: { status },
    });
  });

  it('allows notes to be cleared and passes normalized update dates', async () => {
    const clear = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`)
      .set(auth('organization-admin-token'))
      .send({ notes: null });
    const dates = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`)
      .set(auth('organization-admin-token'))
      .send({ issueDate: '2026-08-02', dueDate: '2026-09-01' });
    expect(clear.status).toBe(200);
    expect(clear.body.data.invoice.notes).toBeNull();
    expect(dates.status).toBe(200);
    expect(testApp.services.updateProjectInvoice).toHaveBeenLastCalledWith({
      tenantId: 'trusted-tenant-id',
      projectId,
      invoiceId,
      updates: {
        issueDate: new Date('2026-08-02T00:00:00.000Z'),
        dueDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
  });

  it('rejects empty, immutable, payment, and invalid date updates', async () => {
    for (const body of [
      {},
      { currency: 'USD' },
      { paymentId: 'private' },
      { lineItems: [] },
      { issueDate: '2026-09-01', dueDate: '2026-08-31' },
    ]) {
      const response = await request(testApp.app)
        .patch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`)
        .set(auth('organization-admin-token'))
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['INVOICE_NOT_FOUND', 'The invoice was not found.'],
    ['INVOICE_DATE_RANGE_INVALID', 'The due date must be on or after the issue date.'],
  ])('preserves safe %s service errors', async (code, message) => {
    const service =
      code === 'INVOICE_DATE_RANGE_INVALID'
        ? testApp.services.updateProjectInvoice
        : testApp.services.getProjectInvoice;
    service.mockRejectedValue(
      new ApiError({
        statusCode: code === 'INVOICE_DATE_RANGE_INVALID' ? 400 : 404,
        code,
        message,
      }),
    );
    const method = code === 'INVOICE_DATE_RANGE_INVALID' ? 'patch' : 'get';
    const client = request(testApp.app);
    const action = client[method](`/api/v1/projects/${projectId}/invoices/${invoiceId}`).set(
      auth('organization-admin-token'),
    );
    const response = method === 'patch' ? await action.send({ status: 'paid' }) : await action;
    expect(response.body.error).toEqual({ code, message });
  });

  it.each([
    ['delete', `/api/v1/projects/${projectId}/invoices/${invoiceId}`],
    ['post', `/api/v1/projects/${projectId}/invoices/${invoiceId}/pay`],
    ['get', `/api/v1/projects/${projectId}/invoices/${invoiceId}/pdf`],
    ['post', `/api/v1/projects/${projectId}/invoices/${invoiceId}/email`],
  ])('does not register unsupported %s route', async (method, url) => {
    const response = await request(testApp.app)[method](url).set(auth('organization-admin-token'));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('does not expose IDs, submitted secrets, or tokens in validation errors', async () => {
    const response = await request(testApp.app)
      .patch(`/api/v1/projects/${projectId}/invoices/${invoiceId}`)
      .set(auth('organization-admin-token'))
      .send({
        tenantId: 'private-tenant',
        projectId: 'private-project',
        paymentToken: 'private-token',
      });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('trusted-tenant-id');
    expect(serialized).not.toContain('private-tenant');
    expect(serialized).not.toContain('private-project');
    expect(serialized).not.toContain('private-token');
    expect(serialized).not.toContain('organization-admin-token');
  });
});
