import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  createInvoice: vi.fn(),
  getInvoice: vi.fn(),
  updateInvoice: vi.fn(),
}));
vi.mock('../features/projects/project-api.js', () => ({ getProject: api.getProject }));
vi.mock('../features/invoices/invoice-api.js', () => ({
  createInvoice: api.createInvoice,
  getInvoice: api.getInvoice,
  updateInvoice: api.updateInvoice,
}));
import { InvoiceCreatePage } from './invoice-create-page.jsx';
import { InvoiceDetailPage } from './invoice-detail-page.jsx';
import { InvoiceEditPage } from './invoice-edit-page.jsx';

const project = { id: 'project-1', name: 'Website Redesign' };
const invoice = {
  id: 'invoice-1',
  projectId: 'project-1',
  invoiceNumber: 'INV-1001',
  amountCents: 125000,
  currency: 'USD',
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-31T00:00:00.000Z',
  status: 'draft',
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  tenantId: 'hidden-tenant',
};

function renderPage(path, element, route) {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route
            path="/projects/:projectId/invoices/:invoiceId"
            element={<div>Invoice destination</div>}
          />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getProject.mockResolvedValue(project);
  api.getInvoice.mockResolvedValue(invoice);
  api.createInvoice.mockResolvedValue(invoice);
  api.updateInvoice.mockResolvedValue(invoice);
});

describe('InvoiceCreatePage', () => {
  it('loads Project context, creates with integer cents, and navigates to details', async () => {
    renderPage(
      '/projects/project-1/invoices/new',
      <InvoiceCreatePage />,
      '/projects/:projectId/invoices/new',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading project');
    expect(await screen.findByRole('link', { name: 'Website Redesign' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Invoice number'), { target: { value: 'INV-1001' } });
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '1250.00' } });
    fireEvent.change(screen.getByLabelText('Issue date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    await waitFor(() => expect(api.createInvoice).toHaveBeenCalledWith({
      projectId: 'project-1',
      invoiceNumber: 'INV-1001',
      amountCents: 125000,
      issueDate: '2026-08-01T00:00:00.000Z',
      dueDate: '2026-08-31T00:00:00.000Z',
    }, 'memory-token'));
    const input = api.createInvoice.mock.calls[0][0];
    expect(input).not.toHaveProperty('tenantId');
    expect(input).not.toHaveProperty('currency');
    expect(input).not.toHaveProperty('status');
    expect(await screen.findByText('Invoice destination')).toBeInTheDocument();
  });

  it('prevents invalid creation and handles Project/date errors safely', async () => {
    renderPage(
      '/projects/project-1/invoices/new',
      <InvoiceCreatePage />,
      '/projects/:projectId/invoices/new',
    );
    await screen.findByLabelText('Invoice number');
    fireEvent.click(screen.getByRole('button', { name: 'Create Invoice' }));
    expect(api.createInvoice).not.toHaveBeenCalled();
    expect(screen.getByText('Invoice number is required.')).toBeInTheDocument();
  });

  it('handles PROJECT_NOT_FOUND safely', async () => {
    api.getProject.mockRejectedValue({ code: 'PROJECT_NOT_FOUND', message: 'private' });
    renderPage(
      '/projects/project-1/invoices/new',
      <InvoiceCreatePage />,
      '/projects/:projectId/invoices/new',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('The project was not found.');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});

describe('InvoiceDetailPage', () => {
  it.each(['draft', 'sent', 'paid', 'void'])(
    'renders safe %s details, Project context, and no deferred actions',
    async (status) => {
      api.getInvoice.mockResolvedValue({ ...invoice, status });
      renderPage(
        '/projects/project-1/invoices/invoice-1',
        <InvoiceDetailPage />,
        '/projects/:projectId/invoices/:invoiceId',
      );
      expect(screen.getByRole('status')).toHaveTextContent('Loading invoice');
      expect(await screen.findByRole('heading', { name: 'INV-1001' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Website Redesign' })).toBeInTheDocument();
      expect(screen.getByText('$1,250.00 USD')).toBeInTheDocument();
      expect(screen.getByText(status[0].toUpperCase() + status.slice(1))).toBeInTheDocument();
      expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
      expect(screen.getByText('Aug 31, 2026')).toBeInTheDocument();
      expect(screen.getByText('No notes provided.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Edit Invoice' })).toHaveAttribute(
        'href',
        '/projects/project-1/invoices/invoice-1/edit',
      );
      expect(screen.getByRole('link', { name: 'Back to Project' })).toBeInTheDocument();
      expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
      expect(screen.queryByText(/overdue|line items|payment history/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete|pay now|pdf|email/i }))
        .not.toBeInTheDocument();
    },
  );

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['INVOICE_NOT_FOUND', 'The invoice was not found.'],
  ])('handles %s safely', async (code, message) => {
    api.getInvoice.mockRejectedValue({ code });
    renderPage(
      '/projects/project-1/invoices/invoice-1',
      <InvoiceDetailPage />,
      '/projects/:projectId/invoices/:invoiceId',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});

describe('InvoiceEditPage', () => {
  it('prepopulates all fields, converts cents, clears notes, changes status, and navigates', async () => {
    api.getInvoice.mockResolvedValue({ ...invoice, notes: 'Clear me' });
    renderPage(
      '/projects/project-1/invoices/invoice-1/edit',
      <InvoiceEditPage />,
      '/projects/:projectId/invoices/:invoiceId/edit',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading invoice');
    expect(await screen.findByLabelText('Invoice number')).toHaveValue('INV-1001');
    expect(screen.getByLabelText('Amount (USD)')).toHaveValue('1250.00');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-08-31');
    expect(screen.getByLabelText('Notes')).toHaveValue('Clear me');
    expect(screen.getByLabelText('Status')).toHaveValue('draft');
    expect(screen.queryByLabelText(/tenant|project id|currency/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '1500.50' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateInvoice).toHaveBeenCalledWith({
      projectId: 'project-1',
      invoiceId: 'invoice-1',
      updates: { amountCents: 150050, notes: null, status: 'paid' },
    }, 'memory-token'));
    expect(api.updateInvoice.mock.calls[0][0].updates).not.toHaveProperty('projectId');
    expect(await screen.findByText('Invoice destination')).toBeInTheDocument();
  });

  it('rejects invalid date order and preserves edits after a safe server error', async () => {
    api.updateInvoice.mockRejectedValue({
      code: 'INVOICE_DATE_RANGE_INVALID',
      message: 'private',
    });
    renderPage(
      '/projects/project-1/invoices/invoice-1/edit',
      <InvoiceEditPage />,
      '/projects/:projectId/invoices/:invoiceId/edit',
    );
    await screen.findByLabelText('Invoice number');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText(/Due date must be on or after/)).toBeInTheDocument();
    expect(api.updateInvoice).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Invoice number'), {
      target: { value: 'Preserved edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The due date must be on or after the issue date.',
    );
    expect(screen.getByLabelText('Invoice number')).toHaveValue('Preserved edit');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['INVOICE_NOT_FOUND', 'The invoice was not found.'],
  ])('handles %s during load', async (code, message) => {
    api.getInvoice.mockRejectedValue({ code });
    renderPage(
      '/projects/project-1/invoices/invoice-1/edit',
      <InvoiceEditPage />,
      '/projects/:projectId/invoices/:invoiceId/edit',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
