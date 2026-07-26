import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthContext } from './features/auth/auth-context.js';
import { AuthProvider } from './features/auth/auth-provider.jsx';
import { USER_ROLE } from './features/auth/auth.constants.js';

const clientApi = vi.hoisted(() => ({
  listClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
}));
const projectApi = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));
const milestoneApi = vi.hoisted(() => ({
  listMilestones: vi.fn(),
  getMilestone: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
}));
const projectFileApi = vi.hoisted(() => ({
  listProjectFiles: vi.fn(),
  getProjectFile: vi.fn(),
  uploadProjectFile: vi.fn(),
  updateProjectFile: vi.fn(),
  downloadProjectFile: vi.fn(),
}));
const invoiceApi = vi.hoisted(() => ({
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
}));
const dashboardApi = vi.hoisted(() => ({
  getOrganizationDashboard: vi.fn(),
}));
const superAdminApi = vi.hoisted(() => ({
  getSuperAdminOverview: vi.fn(),
  listOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  updateOrganizationStatus: vi.fn(),
  listOrganizationUsers: vi.fn(),
}));
vi.mock('./features/clients/client-api.js', () => clientApi);
vi.mock('./features/projects/project-api.js', () => projectApi);
vi.mock('./features/milestones/milestone-api.js', () => milestoneApi);
vi.mock('./features/project-files/project-file-api.js', () => projectFileApi);
vi.mock('./features/invoices/invoice-api.js', () => invoiceApi);
vi.mock('./features/dashboard/dashboard-api.js', () => dashboardApi);
vi.mock('./features/super-admin/super-admin-api.js', () => superAdminApi);
import App from './App.jsx';

const client = {
  id: 'client-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  companyName: null,
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const project = {
  id: 'project-1',
  clientId: 'client-1',
  name: 'Website Redesign',
  description: null,
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const milestone = {
  id: 'milestone-1',
  projectId: 'project-1',
  title: 'Design approval',
  description: null,
  dueDate: null,
  status: 'pending',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
};
const projectFile = {
  id: 'file-1',
  projectId: 'project-1',
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 120,
  description: null,
  status: 'active',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
};
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
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
};

function renderRoute(path, role, status = 'authenticated') {
  return render(
    <AuthContext.Provider value={{
      status,
      user: status === 'authenticated' ? { role, firstName: 'Admin' } : null,
      organization: { name: 'Acme' },
      accessToken: status === 'authenticated' ? 'memory-token' : null,
      clearSession: vi.fn(),
      logout: vi.fn(),
    }}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  clientApi.listClients.mockReset();
  clientApi.getClient.mockReset();
  clientApi.listClients.mockResolvedValue({ clients: [], pagination: { page: 1, totalPages: 0 } });
  clientApi.getClient.mockResolvedValue(client);
  projectApi.listProjects.mockReset();
  projectApi.getProject.mockReset();
  projectApi.listProjects.mockResolvedValue({
    projects: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  });
  projectApi.getProject.mockResolvedValue(project);
  Object.values(milestoneApi).forEach((mock) => mock.mockReset());
  milestoneApi.listMilestones.mockResolvedValue({
    milestones: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  });
  milestoneApi.getMilestone.mockResolvedValue(milestone);
  milestoneApi.createMilestone.mockResolvedValue(milestone);
  milestoneApi.updateMilestone.mockResolvedValue(milestone);
  Object.values(projectFileApi).forEach((mock) => mock.mockReset());
  projectFileApi.listProjectFiles.mockResolvedValue({
    files: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  });
  projectFileApi.getProjectFile.mockResolvedValue(projectFile);
  projectFileApi.uploadProjectFile.mockResolvedValue(projectFile);
  projectFileApi.updateProjectFile.mockResolvedValue(projectFile);
  projectFileApi.downloadProjectFile.mockResolvedValue('proposal.pdf');
  Object.values(invoiceApi).forEach((mock) => mock.mockReset());
  invoiceApi.listInvoices.mockResolvedValue({
    invoices: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  });
  invoiceApi.getInvoice.mockResolvedValue(invoice);
  invoiceApi.createInvoice.mockResolvedValue(invoice);
  invoiceApi.updateInvoice.mockResolvedValue(invoice);
  dashboardApi.getOrganizationDashboard.mockReset();
  dashboardApi.getOrganizationDashboard.mockResolvedValue({
    clients: { total: 0, active: 0, inactive: 0 },
    projects: { total: 0, active: 0, onHold: 0, completed: 0, archived: 0 },
    milestones: { total: 0, pending: 0, inProgress: 0, completed: 0 },
    files: { total: 0, active: 0, archived: 0 },
    invoices: { total: 0, draft: 0, sent: 0, paid: 0, void: 0 },
  });
  Object.values(superAdminApi).forEach((mock) => mock.mockReset());
  superAdminApi.getSuperAdminOverview.mockResolvedValue({
    organizations: { total: 0, active: 0, suspended: 0 },
    users: { total: 0, organizationAdmins: 0, clients: 0 },
  });
  superAdminApi.listOrganizations.mockResolvedValue({
    organizations: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  });
  superAdminApi.getOrganization.mockResolvedValue({
    id: 'organization-id',
    name: 'Acme',
    slug: 'acme',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    userCounts: { total: 0, organizationAdmins: 0, clients: 0 },
  });
  superAdminApi.listOrganizationUsers.mockResolvedValue({
    users: [],
    pagination: { page: 1, total: 0, totalPages: 0 },
  });
});

describe('Organization Dashboard routing and navigation', () => {
  it('allows Organization Admin access to /dashboard', async () => {
    renderRoute('/dashboard', USER_ROLE.ORGANIZATION_ADMIN);
    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' }))
      .toBeInTheDocument();
  });

  it.each([USER_ROLE.CLIENT, USER_ROLE.SUPER_ADMIN])(
    'redirects %s away from the tenant dashboard',
    async (role) => {
      renderRoute('/dashboard', role);
      const destination = role === USER_ROLE.CLIENT ? 'Client workspace' : 'Platform Overview';
      expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
      expect(dashboardApi.getOrganizationDashboard).not.toHaveBeenCalled();
    },
  );

  it('redirects unauthenticated users away from the tenant dashboard', async () => {
    renderRoute('/dashboard', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(dashboardApi.getOrganizationDashboard).not.toHaveBeenCalled();
  });

  it('shows Dashboard first only for Organization Admin and retains active navigation styling', () => {
    const { unmount } = renderRoute('/dashboard', USER_ROLE.ORGANIZATION_ADMIN);
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = within(navigation).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Dashboard');
    expect(links[0]).toHaveAttribute('href', '/dashboard');
    expect(links[0]).toHaveClass('nav-link-active');
    expect(within(navigation).getByRole('link', { name: 'Clients' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(within(navigation).queryByText(/Analytics|Reports|Revenue|Milestones|Files|Invoices/))
      .not.toBeInTheDocument();
    unmount();

    const clientView = renderRoute('/client', USER_ROLE.CLIENT);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    clientView.unmount();
    renderRoute('/super-admin', USER_ROLE.SUPER_ADMIN);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('keeps unknown Dashboard routes on the not-found page', async () => {
    renderRoute('/dashboard/unknown', USER_ROLE.ORGANIZATION_ADMIN);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it.each(['/milestones', '/files', '/invoices'])(
    'does not introduce a top-level %s route',
    async (path) => {
      renderRoute(path, USER_ROLE.ORGANIZATION_ADMIN);
      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    },
  );

  it('preserves authentication restoration during direct Dashboard navigation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          user: { role: USER_ROLE.ORGANIZATION_ADMIN, firstName: 'Admin' },
          organization: { name: 'Acme' },
          accessToken: 'restored-memory-token',
        },
      }),
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Restoring your session');
    expect(await screen.findByRole('heading', { level: 2, name: 'Clients' }))
      .toBeInTheDocument();
    expect(dashboardApi.getOrganizationDashboard).toHaveBeenCalledWith(
      { signal: expect.any(AbortSignal) },
      'restored-memory-token',
    );
  });

  it('shows a safe suspended-Organization message when restoration is rejected', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'ORGANIZATION_SUSPENDED',
          message: '<img src=x onerror=alert(1)> private tenant data',
        },
      }),
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This organization is suspended.');
    expect(alert).not.toHaveTextContent(/img|private tenant data/i);
    expect(alert.querySelector('img')).toBeNull();
  });
});

describe('Super Admin routing and navigation', () => {
  it.each([
    ['/super-admin', 'Platform Overview'],
    ['/super-admin/organizations', 'Organizations'],
    ['/super-admin/organizations/organization-id', 'Acme'],
  ])('allows Super Admin access to %s', async (path, heading) => {
    renderRoute(path, USER_ROLE.SUPER_ADMIN);
    expect(await screen.findByRole('heading', { level: 1, name: heading }))
      .toBeInTheDocument();
  });

  it.each([USER_ROLE.ORGANIZATION_ADMIN, USER_ROLE.CLIENT])(
    'redirects %s away from Super Admin routes',
    async (role) => {
      renderRoute('/super-admin/organizations', role);
      const destination = role === USER_ROLE.ORGANIZATION_ADMIN ? 'Dashboard' : 'Client workspace';
      expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
      expect(superAdminApi.listOrganizations).not.toHaveBeenCalled();
    },
  );

  it('redirects unauthenticated users away from Super Admin routes', async () => {
    renderRoute('/super-admin/organizations/organization-id', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(superAdminApi.getOrganization).not.toHaveBeenCalled();
  });

  it('shows only platform navigation to Super Admin', () => {
    renderRoute('/super-admin/organizations', USER_ROLE.SUPER_ADMIN);
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(navigation).getByRole('link', { name: 'Platform Overview' }))
      .toHaveAttribute('href', '/super-admin');
    expect(within(navigation).getByRole('link', { name: 'Organizations' }))
      .toHaveClass('nav-link-active');
    expect(within(navigation).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(
      within(navigation).queryByText(/Dashboard|Clients|Projects|Billing|Reports|Invoices|Files/),
    ).not.toBeInTheDocument();
  });

  it('uses not-found for unknown Super Admin routes', async () => {
    renderRoute('/super-admin/unknown', USER_ROLE.SUPER_ADMIN);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('application Project routes and navigation', () => {
  it.each([
    ['/projects', 'Projects'],
    ['/projects/new', 'Create Project'],
    ['/projects/project-1', 'Website Redesign'],
    ['/projects/project-1/edit', 'Edit Project'],
  ])('allows Organization Admin access to %s', async (path, heading) => {
    clientApi.listClients.mockResolvedValue({
      clients: [client],
      pagination: { page: 1, totalPages: 1 },
    });
    renderRoute(path, USER_ROLE.ORGANIZATION_ADMIN);
    if (path.endsWith('/edit')) {
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    } else {
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
  });

  it.each([USER_ROLE.CLIENT, USER_ROLE.SUPER_ADMIN])(
    'redirects %s users away from tenant Project routes',
    async (role) => {
      renderRoute('/projects', role);
      const destination = role === USER_ROLE.CLIENT ? 'Client workspace' : 'Platform Overview';
      expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users away from Project routes', async () => {
    renderRoute('/projects/new', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows Projects and Clients navigation only to Organization Admin users', () => {
    const { unmount } = renderRoute('/admin', USER_ROLE.ORGANIZATION_ADMIN);
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Clients' })).toHaveAttribute('href', '/admin/clients');
    unmount();
    renderRoute('/client', USER_ROLE.CLIENT);
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
  });

  it('keeps unknown Project routes on the existing not-found page', async () => {
    renderRoute('/projects/project-1/unknown', USER_ROLE.ORGANIZATION_ADMIN);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it.each([
    ['/projects/project-1/milestones/new', 'Create Milestone'],
    ['/projects/project-1/milestones/milestone-1', 'Design approval'],
    ['/projects/project-1/milestones/milestone-1/edit', 'Edit Milestone'],
  ])('allows Organization Admin access to %s', async (path, heading) => {
    renderRoute(path, USER_ROLE.ORGANIZATION_ADMIN);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    });
  });

  it.each([USER_ROLE.CLIENT, USER_ROLE.SUPER_ADMIN])(
    'redirects %s users away from tenant Milestone routes',
    async (role) => {
      renderRoute('/projects/project-1/milestones/new', role);
      const destination = role === USER_ROLE.CLIENT ? 'Client workspace' : 'Platform Overview';
      expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users away from Milestone routes', async () => {
    renderRoute('/projects/project-1/milestones/milestone-1', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('does not add top-level Milestones navigation', () => {
    renderRoute('/admin', USER_ROLE.ORGANIZATION_ADMIN);
    expect(screen.queryByRole('link', { name: 'Milestones' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clients' })).toBeInTheDocument();
  });

  it('uses the not-found page for unknown nested Milestone routes', async () => {
    renderRoute(
      '/projects/project-1/milestones/milestone-1/unknown',
      USER_ROLE.ORGANIZATION_ADMIN,
    );
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it.each([
    ['/projects/project-1/files/new', 'Upload File'],
    ['/projects/project-1/files/file-1', 'proposal.pdf'],
    ['/projects/project-1/files/file-1/edit', 'Edit file metadata'],
  ])('allows Organization Admin access to %s', async (path, heading) => {
    renderRoute(path, USER_ROLE.ORGANIZATION_ADMIN);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    });
  });

  it.each([USER_ROLE.CLIENT, USER_ROLE.SUPER_ADMIN])(
    'redirects %s users away from tenant Project File routes',
    async (role) => {
      renderRoute('/projects/project-1/files/new', role);
      const destination = role === USER_ROLE.CLIENT ? 'Client workspace' : 'Platform Overview';
      expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users away from Project File routes', async () => {
    renderRoute('/projects/project-1/files/file-1', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('adds no top-level Files navigation and preserves Project and Client navigation', () => {
    renderRoute('/admin', USER_ROLE.ORGANIZATION_ADMIN);
    expect(screen.queryByRole('link', { name: 'Files' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clients' })).toBeInTheDocument();
  });

  it('does not interpret files/new as a file ID and uses not-found for unknown file routes', async () => {
    renderRoute('/projects/project-1/files/new', USER_ROLE.ORGANIZATION_ADMIN);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upload File' })).toBeInTheDocument();
    });
    expect(projectFileApi.getProjectFile).not.toHaveBeenCalled();
  });

  it('uses the existing not-found page for unknown nested Project File routes', async () => {
    renderRoute(
      '/projects/project-1/files/file-1/unknown',
      USER_ROLE.ORGANIZATION_ADMIN,
    );
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it.each([
    ['/projects/project-1/invoices/new', 'Create Invoice'],
    ['/projects/project-1/invoices/invoice-1', 'INV-1001'],
    ['/projects/project-1/invoices/invoice-1/edit', 'Edit Invoice'],
  ])('allows Organization Admin access to %s', async (path, heading) => {
    renderRoute(path, USER_ROLE.ORGANIZATION_ADMIN);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    });
  });

  it.each([USER_ROLE.CLIENT, USER_ROLE.SUPER_ADMIN])(
    'redirects %s users away from tenant Invoice routes',
    async (role) => {
      renderRoute('/projects/project-1/invoices/new', role);
      const destination = role === USER_ROLE.CLIENT ? 'Client workspace' : 'Platform Overview';
      expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users away from Invoice routes', async () => {
    renderRoute('/projects/project-1/invoices/invoice-1', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('adds no top-level Invoices navigation and preserves Projects and Clients', () => {
    renderRoute('/admin', USER_ROLE.ORGANIZATION_ADMIN);
    expect(screen.queryByRole('link', { name: 'Invoices' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clients' })).toBeInTheDocument();
  });

  it('does not interpret invoices/new as an Invoice ID', async () => {
    renderRoute('/projects/project-1/invoices/new', USER_ROLE.ORGANIZATION_ADMIN);
    await screen.findByRole('heading', { name: 'Create Invoice' });
    expect(invoiceApi.getInvoice).not.toHaveBeenCalled();
  });

  it('uses not-found for unknown nested Invoice routes', async () => {
    renderRoute(
      '/projects/project-1/invoices/invoice-1/unknown',
      USER_ROLE.ORGANIZATION_ADMIN,
    );
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('application Client routes', () => {
  it.each([
    ['/admin/clients', 'Clients'],
    ['/admin/clients/new', 'Add client'],
    ['/admin/clients/client-1', 'Ada Lovelace'],
  ])('allows Organization Admin access to %s', async (path, heading) => {
    renderRoute(path, USER_ROLE.ORGANIZATION_ADMIN);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('redirects Client users away from Admin Client routes', async () => {
    renderRoute('/admin/clients', USER_ROLE.CLIENT);
    expect(await screen.findByRole('heading', { name: 'Client workspace' })).toBeInTheDocument();
  });

  it('redirects Super Admin users away from tenant Client routes', async () => {
    renderRoute('/admin/clients/new', USER_ROLE.SUPER_ADMIN);
    expect(await screen.findByRole('heading', { name: 'Platform Overview' })).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', async () => {
    renderRoute('/admin/clients', null, 'unauthenticated');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it.each([
    ['/login', 'Welcome back', 'unauthenticated', null],
    ['/register', 'Create your workspace', 'unauthenticated', null],
    ['/admin', 'Organization Admin', 'authenticated', USER_ROLE.ORGANIZATION_ADMIN],
    ['/client', 'Client workspace', 'authenticated', USER_ROLE.CLIENT],
    ['/super-admin', 'Platform Overview', 'authenticated', USER_ROLE.SUPER_ADMIN],
  ])('preserves the existing %s route', async (path, heading, status, role) => {
    renderRoute(path, role, status);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
