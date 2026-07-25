import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthContext } from './features/auth/auth-context.js';
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
vi.mock('./features/clients/client-api.js', () => clientApi);
vi.mock('./features/projects/project-api.js', () => projectApi);
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
      const destination = role === USER_ROLE.CLIENT ? 'Client workspace' : 'Super Admin console';
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
    expect(await screen.findByRole('heading', { name: 'Super Admin console' })).toBeInTheDocument();
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
    ['/super-admin', 'Super Admin console', 'authenticated', USER_ROLE.SUPER_ADMIN],
  ])('preserves the existing %s route', async (path, heading, status, role) => {
    renderRoute(path, role, status);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
