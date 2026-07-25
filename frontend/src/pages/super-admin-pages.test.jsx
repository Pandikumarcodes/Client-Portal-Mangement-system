import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({
  getSuperAdminOverview: vi.fn(),
  listOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  updateOrganizationStatus: vi.fn(),
  listOrganizationUsers: vi.fn(),
}));
vi.mock('../features/super-admin/super-admin-api.js', () => api);

import { SuperAdminHomePage } from './super-admin-home-page.jsx';
import { SuperAdminOrganizationDetailPage } from './super-admin-organization-detail-page.jsx';
import { SuperAdminOrganizationsPage } from './super-admin-organizations-page.jsx';

const organization = {
  id: 'organization-id',
  name: 'Acme Studio',
  slug: 'acme-studio',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  userCounts: { total: 2, organizationAdmins: 1, clients: 1 },
  tenantId: 'hidden-tenant',
};
const tenantUser = {
  id: 'user-id',
  organizationId: 'organization-id',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'organization_admin',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  passwordHash: 'hidden-password',
  refreshTokenHash: 'hidden-token',
};

function renderPage(path, element, routePath = path) {
  const auth = {
    accessToken: 'memory-token',
    clearSession: vi.fn(),
  };
  const rendered = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { ...rendered, auth };
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getSuperAdminOverview.mockResolvedValue({
    organizations: { total: 3, active: 2, suspended: 1 },
    users: { total: 8, organizationAdmins: 3, clients: 5 },
  });
  api.listOrganizations.mockResolvedValue({
    organizations: [organization],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  api.getOrganization.mockResolvedValue(organization);
  api.updateOrganizationStatus.mockResolvedValue({ ...organization, status: 'suspended' });
  api.listOrganizationUsers.mockResolvedValue({
    users: [tenantUser, { ...tenantUser, id: 'super-id', role: 'super_admin' }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
});

describe('Super Admin overview page', () => {
  it('renders loading, Organization/user counts, and the Organizations link', async () => {
    let resolve;
    api.getSuperAdminOverview.mockReturnValue(new Promise((done) => {
      resolve = done;
    }));
    renderPage('/super-admin', <SuperAdminHomePage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading platform overview');
    resolve({
      organizations: { total: 3, active: 2, suspended: 1 },
      users: { total: 8, organizationAdmins: 3, clients: 5 },
    });
    await screen.findByRole('heading', { name: 'Organizations' });
    expect(screen.getByRole('link', { name: 'View Organizations' }))
      .toHaveAttribute('href', '/super-admin/organizations');
    expect(screen.getByText('Organization Admins')).toBeInTheDocument();
    expect(screen.queryByText(/Revenue|Projects|Files|tenantId|hidden-tenant/i))
      .not.toBeInTheDocument();
  });

  it('accepts all-zero counts and supports safe retry', async () => {
    api.getSuperAdminOverview
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'private' })
      .mockResolvedValueOnce({
        organizations: { total: 0, active: 0, suspended: 0 },
        users: { total: 0, organizationAdmins: 0, clients: 0 },
      });
    renderPage('/super-admin', <SuperAdminHomePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading overview' }));
    await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(6));
  });
});

describe('Super Admin Organization list page', () => {
  it('renders safe columns, details links, filters, and pagination', async () => {
    renderPage('/super-admin/organizations', <SuperAdminOrganizationsPage />);
    expect(await screen.findByText('Acme Studio')).toBeInTheDocument();
    expect(screen.getByText('acme-studio')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'View details' }))
      .toHaveAttribute('href', '/super-admin/organizations/organization-id');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Create|Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Billing|Revenue|Subscription|hidden-tenant/)).not.toBeInTheDocument();
  });

  it('updates the status filter, resets page one, and renders filtered empty state', async () => {
    api.listOrganizations
      .mockResolvedValueOnce({
        organizations: [organization],
        pagination: { page: 1, totalPages: 2 },
      })
      .mockResolvedValue({
        organizations: [],
        pagination: { page: 1, totalPages: 0 },
      });
    renderPage('/super-admin/organizations', <SuperAdminOrganizationsPage />);
    await screen.findByText('Acme Studio');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'suspended' } });
    await waitFor(() => expect(api.listOrganizations).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, limit: 20, status: 'suspended' }),
      'memory-token',
    ));
    expect(await screen.findByText('No Organizations match this status.')).toBeInTheDocument();
  });
});

describe('Super Admin Organization detail page', () => {
  const renderDetail = () =>
    renderPage(
      '/super-admin/organizations/organization-id',
      <SuperAdminOrganizationDetailPage />,
      '/super-admin/organizations/:organizationId',
    );

  it('renders safe details, counts, users, and no tenant business or security data', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Acme Studio' })).toBeInTheDocument();
    expect(screen.getByText('acme-studio')).toBeInTheDocument();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/hidden-password|hidden-token|hidden-tenant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Projects|Invoices|Files|Milestones/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete|Edit|Reset|Impersonate|Create/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByText('super_admin')).not.toBeInTheDocument();
  });

  it('suspends explicitly, prevents duplicate submission, and explains retained data/token limits', async () => {
    let resolve;
    api.updateOrganizationStatus.mockReturnValue(new Promise((done) => {
      resolve = done;
    }));
    renderDetail();
    const button = await screen.findByRole('button', { name: 'Suspend Organization' });
    expect(screen.getByText(/does not delete Organization or tenant data/i)).toBeInTheDocument();
    expect(screen.getByText(/may remain valid until their short expiry/i)).toBeInTheDocument();
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.updateOrganizationStatus).toHaveBeenCalledTimes(1);
    resolve({ ...organization, status: 'suspended' });
    expect(await screen.findByRole('button', { name: 'Activate Organization' }))
      .toBeInTheDocument();
    expect(screen.getByText(/data was retained/i)).toBeInTheDocument();
  });

  it('handles not found safely and filters users by supported role/status', async () => {
    api.getOrganization.mockRejectedValue({ code: 'ORGANIZATION_NOT_FOUND' });
    const { unmount } = renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent('organization was not found');
    unmount();

    api.getOrganization.mockResolvedValue(organization);
    renderDetail();
    await screen.findByText('Ada Lovelace');
    const usersSection = screen.getByRole('heading', { name: 'Organization users' }).parentElement;
    fireEvent.change(within(usersSection).getByLabelText('Role'), {
      target: { value: 'client' },
    });
    fireEvent.change(within(usersSection).getByLabelText('Status'), {
      target: { value: 'suspended' },
    });
    await waitFor(() => expect(api.listOrganizationUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        organizationId: 'organization-id',
        page: 1,
        role: 'client',
        status: 'suspended',
      }),
      'memory-token',
    ));
  });
});
