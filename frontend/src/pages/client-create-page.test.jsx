import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const createClient = vi.hoisted(() => vi.fn());
vi.mock('../features/clients/client-api.js', () => ({ createClient }));
import { ClientCreatePage } from './client-create-page.jsx';

function renderPage() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={['/admin/clients/new']}>
        <Routes>
          <Route path="/admin/clients/new" element={<ClientCreatePage />} />
          <Route path="/admin/clients/:clientId" element={<div>Client destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ADA@Example.com' } });
}

beforeEach(() => {
  createClient.mockReset();
  createClient.mockResolvedValue({ id: 'client/id' });
});

describe('ClientCreatePage', () => {
  it('renders the heading, form, and cancel link', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Add client' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/admin/clients');
  });

  it('creates with the access token and navigates to the encoded detail route', async () => {
    renderPage();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add client' }));
    await waitFor(() => expect(createClient).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      companyName: undefined,
    }, 'memory-token'));
    expect(await screen.findByText('Client destination')).toBeInTheDocument();
  });

  it.each([
    ['CLIENT_EMAIL_ALREADY_IN_USE', 'A client with this email already exists.'],
    ['NETWORK_ERROR', 'Unable to connect to the server. Check your connection and try again.'],
  ])('renders a safe %s error', async (code, expected) => {
    createClient.mockRejectedValue({ code, message: 'token=private-token' });
    renderPage();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add client' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    expect(screen.queryByText(/private-token/)).not.toBeInTheDocument();
  });

  it('prevents duplicate submissions while a request is pending', async () => {
    createClient.mockReturnValue(new Promise(() => {}));
    renderPage();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add client' }));
    expect(screen.getByRole('button', { name: 'Adding client...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Adding client...' }));
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
