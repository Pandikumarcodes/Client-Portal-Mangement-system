import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));

import * as invoiceApi from './invoice-api.js';

const token = 'memory-token';
const invoice = { id: 'invoice-1', invoiceNumber: 'INV-1001' };
const itemResponse = { success: true, data: { invoice } };

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(itemResponse);
});

describe('Invoice API operations', () => {
  it('lists through the nested endpoint with pagination and an optional status', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { invoices: [invoice], pagination: { page: 2, limit: 20 } },
    });
    await expect(invoiceApi.listInvoices({
      projectId: 'project/id',
      page: 2,
      limit: 20,
      status: 'paid',
    }, token)).resolves.toEqual({
      invoices: [invoice],
      pagination: { page: 2, limit: 20 },
    });
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project%2Fid/invoices?page=2&limit=20&status=paid',
      { accessToken: token },
    );
  });

  it('omits a blank status and forwards AbortSignal', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { invoices: [], pagination: { page: 1 } },
    });
    const controller = new AbortController();
    await invoiceApi.listInvoices({
      projectId: 'project-1',
      status: ' ',
      signal: controller.signal,
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project-1/invoices?page=1&limit=20',
      { accessToken: token, signal: controller.signal },
    );
  });

  it('creates with POST and only supported create fields', async () => {
    await invoiceApi.createInvoice({
      projectId: 'project-1',
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: '2026-08-01T00:00:00.000Z',
      dueDate: '2026-08-31T00:00:00.000Z',
      notes: 'Due soon',
      tenantId: 'hidden',
      currency: 'USD',
      status: 'paid',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith('/projects/project-1/invoices', {
      method: 'POST',
      body: {
        invoiceNumber: 'INV-1001',
        amountCents: 125000,
        issueDate: '2026-08-01T00:00:00.000Z',
        dueDate: '2026-08-31T00:00:00.000Z',
        notes: 'Due soon',
      },
      accessToken: token,
    });
  });

  it('omits blank create notes', async () => {
    await invoiceApi.createInvoice({
      projectId: 'project-1',
      invoiceNumber: 'INV',
      amountCents: 1,
      issueDate: 'date',
      dueDate: 'date',
      notes: ' ',
    }, token);
    expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty('notes');
  });

  it('gets using both IDs and forwards AbortSignal', async () => {
    const controller = new AbortController();
    await invoiceApi.getInvoice({
      projectId: 'project/id',
      invoiceId: 'invoice/id',
      signal: controller.signal,
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project%2Fid/invoices/invoice%2Fid',
      { accessToken: token, signal: controller.signal },
    );
  });

  it('updates with PATCH, supported fields only, and preserves null notes', async () => {
    await invoiceApi.updateInvoice({
      projectId: 'project-1',
      invoiceId: 'invoice-1',
      updates: {
        invoiceNumber: 'INV-2',
        amountCents: 200,
        issueDate: 'issue',
        dueDate: 'due',
        status: 'void',
        notes: null,
        tenantId: 'hidden',
        projectId: 'hidden',
        invoiceId: 'hidden',
        currency: 'USD',
        createdAt: 'hidden',
        unsupported: undefined,
      },
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project-1/invoices/invoice-1',
      {
        method: 'PATCH',
        body: {
          invoiceNumber: 'INV-2',
          amountCents: 200,
          issueDate: 'issue',
          dueDate: 'due',
          status: 'void',
          notes: null,
        },
        accessToken: token,
      },
    );
  });

  it('propagates safe API errors and rejects malformed responses', async () => {
    const error = { code: 'INVOICE_NOT_FOUND' };
    apiRequest.mockRejectedValue(error);
    await expect(invoiceApi.getInvoice({
      projectId: 'project-1',
      invoiceId: 'missing',
    }, token)).rejects.toBe(error);
    apiRequest.mockResolvedValue({ success: true, data: {} });
    await expect(invoiceApi.createInvoice({ projectId: 'project-1' }, token))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(invoiceApi.listInvoices({ projectId: 'project-1' }, token))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('requires both IDs where applicable and never sends a request without them', async () => {
    await expect(invoiceApi.listInvoices({}, token)).rejects.toThrow('Project ID');
    await expect(invoiceApi.createInvoice({}, token)).rejects.toThrow('Project ID');
    await expect(invoiceApi.getInvoice({ projectId: 'p' }, token)).rejects.toThrow('Invoice ID');
    await expect(invoiceApi.updateInvoice({ projectId: 'p' }, token)).rejects.toThrow('Invoice ID');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('exports no deletion, payment, or PDF operations and uses no browser storage', () => {
    expect(invoiceApi.deleteInvoice).toBeUndefined();
    expect(invoiceApi.payInvoice).toBeUndefined();
    expect(invoiceApi.downloadInvoicePdf).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
