import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../auth/auth-context.js';

const listInvoices = vi.hoisted(() => vi.fn());
vi.mock('./invoice-api.js', () => ({ listInvoices }));
import { InvoiceList } from './invoice-list.jsx';

const invoice = {
  id: 'invoice-1',
  projectId: 'project-1',
  invoiceNumber: 'INV-1001',
  amountCents: 125000,
  currency: 'USD',
  issueDate: '2026-08-01T00:00:00.000Z',
  dueDate: '2026-08-31T00:00:00.000Z',
  status: 'void',
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  tenantId: 'hidden-tenant',
};

function renderList() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter><InvoiceList projectId="project-1" /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  listInvoices.mockReset();
  listInvoices.mockResolvedValue({
    invoices: [invoice],
    pagination: { page: 1, total: 1, totalPages: 1 },
  });
});

describe('InvoiceList', () => {
  it('renders loading, safe record content, details link, and pagination', async () => {
    renderList();
    expect(screen.getByRole('status')).toHaveTextContent('Loading invoices');
    expect(await screen.findByText('INV-1001')).toBeInTheDocument();
    expect(screen.getByText('$1,250.00')).toBeInTheDocument();
    expect(screen.getByText('Void', { selector: '.status-badge' })).toBeInTheDocument();
    expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
    expect(screen.getByText('Aug 31, 2026')).toBeInTheDocument();
    expect(screen.getByText('No notes provided.')).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/projects/project-1/invoices/invoice-1',
    );
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /delete|pay|pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/total billed|outstanding|chart/i)).not.toBeInTheDocument();
  });

  it('updates the status request, resets page to one, and paginates', async () => {
    listInvoices.mockResolvedValue({
      invoices: [invoice],
      pagination: { page: 1, total: 40, totalPages: 2 },
    });
    renderList();
    await screen.findByText('INV-1001');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listInvoices).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, limit: 20 }),
      'memory-token',
    ));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'void' } });
    await waitFor(() => expect(listInvoices).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, status: 'void', limit: 20 }),
      'memory-token',
    ));
  });

  it('renders unfiltered and filtered empty states with useful actions', async () => {
    listInvoices.mockResolvedValue({
      invoices: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    });
    renderList();
    expect(await screen.findByText(/no invoice records yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Create Invoice' })[0]).toHaveAttribute(
      'href',
      '/projects/project-1/invoices/new',
    );
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paid' } });
    expect(await screen.findByText(/No invoices match/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear status filter' }));
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('renders a safe retryable error', async () => {
    listInvoices.mockRejectedValue({ code: 'FORBIDDEN', message: 'private' });
    renderList();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to manage invoices.',
    );
    expect(screen.queryByText('private')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry loading invoices' })).toBeInTheDocument();
  });
});
