import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({ getClient: vi.fn(), updateClient: vi.fn() }));
vi.mock('../features/clients/client-api.js', () => api);
import { ClientDetailPage } from './client-detail-page.jsx';

const activeClient = {
  id: 'client-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  companyName: 'Analytical Engines',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  tenantId: 'hidden-tenant',
  userId: 'hidden-user',
};

function renderPage(auth = {}) {
  const value = { accessToken: 'memory-token', clearSession: vi.fn(), ...auth };
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/admin/clients/client%2Fid']}>
        <Routes>
          <Route path="/admin/clients/:clientId" element={<ClientDetailPage />} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return value;
}

beforeEach(() => {
  api.getClient.mockReset();
  api.updateClient.mockReset();
  api.getClient.mockResolvedValue(activeClient);
  api.updateClient.mockImplementation(async (_id, updates) => ({ ...activeClient, ...updates }));
});

describe('ClientDetailPage', () => {
  it('loads by route ID and renders safe details and navigation', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading client');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(api.getClient).toHaveBeenCalledWith('client/id', 'memory-token');
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden-user')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to clients' })).toHaveAttribute('href', '/admin/clients');
  });

  it('opens edit mode, cancels it, and saves updates', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit client' }));
    expect(screen.getByRole('heading', { name: 'Edit client details' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));
    expect(screen.queryByRole('heading', { name: 'Edit client details' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit client' }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateClient).toHaveBeenCalledWith(
      'client/id',
      {
        firstName: 'Grace',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        companyName: 'Analytical Engines',
      },
      'memory-token',
    ));
    expect(await screen.findByRole('heading', { level: 1, name: 'Grace Lovelace' })).toBeInTheDocument();
  });

  it('requires confirmation and sends status only when deactivating', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Deactivate client' });
    expect(api.updateClient).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate client' }));
    expect(screen.getByText('Deactivate this client? The profile will remain stored.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, deactivate client' }));
    await waitFor(() => expect(api.updateClient).toHaveBeenCalledWith(
      'client/id',
      { status: 'inactive' },
      'memory-token',
    ));
    expect(await screen.findByRole('button', { name: 'Activate client' })).toBeInTheDocument();
  });

  it('shows activate for an inactive Client', async () => {
    api.getClient.mockResolvedValue({ ...activeClient, status: 'inactive' });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Activate client' })).toBeInTheDocument();
  });

  it('renders not found safely', async () => {
    api.getClient.mockRejectedValue({ code: 'CLIENT_NOT_FOUND', message: 'private response' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('The client was not found.');
    expect(screen.queryByText('private response')).not.toBeInTheDocument();
  });

  it('clears the session and redirects after authentication failure', async () => {
    api.getClient.mockRejectedValue({ code: 'AUTHENTICATION_REQUIRED' });
    const auth = renderPage();
    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
  });
});
