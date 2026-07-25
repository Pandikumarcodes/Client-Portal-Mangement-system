import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const listClients = vi.hoisted(() => vi.fn());
vi.mock('../features/clients/client-api.js', () => ({ listClients }));
import { ClientListPage } from './client-list-page.jsx';

const sampleClient = {
  id: 'client-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  companyName: null,
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  tenantId: 'hidden-tenant',
  userId: 'hidden-user',
};
const result = (clients = [sampleClient], page = 1, totalPages = 2) => ({
  clients,
  pagination: { page, limit: 20, total: clients.length, totalPages },
});

function renderPage(auth = {}) {
  const value = {
    accessToken: 'memory-token',
    clearSession: vi.fn(),
    ...auth,
  };
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/admin/clients']}>
        <Routes>
          <Route path="/admin/clients" element={<ClientListPage />} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return value;
}

beforeEach(() => {
  listClients.mockReset();
  listClients.mockResolvedValue(result());
});

describe('ClientListPage', () => {
  it('renders loading then safe Client fields and the add link', async () => {
    let resolve;
    listClients.mockReturnValue(new Promise((done) => { resolve = done; }));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading clients');
    resolve(result());
    await screen.findByText('Ada Lovelace');
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Not provided')).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden-user')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add client' })).toHaveAttribute('href', '/admin/clients/new');
    expect(listClients).toHaveBeenCalledWith(
      { page: 1, limit: 20, status: undefined },
      'memory-token',
    );
  });

  it('renders the empty state', async () => {
    listClients.mockResolvedValue(result([], 1, 0));
    renderPage();
    expect(await screen.findByText('No clients have been added yet.')).toBeInTheDocument();
  });

  it('shows safe errors and retries', async () => {
    listClients
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'private' })
      .mockResolvedValueOnce(result());
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading clients' }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(listClients).toHaveBeenCalledTimes(2);
  });

  it('passes a status filter and resets pagination to page one', async () => {
    renderPage();
    await screen.findByText('Ada Lovelace');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(
      { page: 2, limit: 20, status: undefined },
      'memory-token',
    ));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(
      { page: 1, limit: 20, status: 'inactive' },
      'memory-token',
    ));
  });

  it('supports previous and next pagination controls', async () => {
    renderPage();
    await screen.findByText('Ada Lovelace');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { page: 1, limit: 20, status: undefined },
      'memory-token',
    ));
  });

  it('clears the session and redirects on authentication failure', async () => {
    listClients.mockRejectedValue({ code: 'AUTHENTICATION_REQUIRED' });
    const auth = renderPage();
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
  });
});
