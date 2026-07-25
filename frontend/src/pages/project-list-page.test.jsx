import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({ listClients: vi.fn(), listProjects: vi.fn() }));
vi.mock('../features/clients/client-api.js', () => ({ listClients: api.listClients }));
vi.mock('../features/projects/project-api.js', () => ({ listProjects: api.listProjects }));
import { ProjectListPage } from './project-list-page.jsx';

const client = {
  id: 'client-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  companyName: 'Analytical Engines',
};
const activeProject = {
  id: 'project-1',
  clientId: 'client-1',
  name: 'Website Redesign',
  description: 'Redesign the public website.',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  tenantId: 'hidden-tenant',
};
const result = (projects = [activeProject], page = 1, totalPages = 2) => ({
  projects,
  pagination: { page, limit: 20, total: projects.length, totalPages },
});

function renderPage() {
  render(
    <AuthContext.Provider value={{
      accessToken: 'memory-token',
      clearSession: vi.fn(),
    }}>
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  api.listClients.mockReset();
  api.listProjects.mockReset();
  api.listClients.mockResolvedValue({
    clients: [client],
    pagination: { page: 1, totalPages: 1 },
  });
  api.listProjects.mockResolvedValue(result());
});

describe('ProjectListPage', () => {
  it('shows loading then renders safe Project fields, Client labels and links', async () => {
    let resolveProjects;
    api.listProjects.mockReturnValue(new Promise((resolve) => { resolveProjects = resolve; }));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
    resolveProjects(result());
    expect(await screen.findByText('Website Redesign')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Analytical Engines — Ada Lovelace')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Project' })).toHaveAttribute('href', '/projects/new');
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/projects/project-1');
  });

  it('renders archived Projects and an unavailable Client fallback', async () => {
    api.listProjects.mockResolvedValue(result([{
      ...activeProject,
      id: 'project-2',
      clientId: 'missing-client',
      status: 'archived',
      description: null,
    }], 1, 1));
    renderPage();
    expect(await screen.findByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Client unavailable')).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('renders general and filtered empty states', async () => {
    api.listProjects.mockResolvedValue(result([], 1, 0));
    renderPage();
    expect(await screen.findByText('No projects have been created yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    expect(await screen.findByText('No projects match the selected filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('updates status and Client filters and resets pagination', async () => {
    renderPage();
    await screen.findByText('Website Redesign');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(api.listProjects).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 20 }),
      'memory-token',
    ));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'on_hold' } });
    await waitFor(() => expect(api.listProjects).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, status: 'on_hold', clientId: undefined }),
      'memory-token',
    ));
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    await waitFor(() => expect(api.listProjects).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, status: 'on_hold', clientId: 'client-1' }),
      'memory-token',
    ));
  });

  it('supports Previous and Next backend pagination', async () => {
    renderPage();
    await screen.findByText('Website Redesign');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(api.listProjects).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
      'memory-token',
    ));
  });

  it('shows a safe retryable error', async () => {
    api.listProjects
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'private-token' })
      .mockResolvedValueOnce(result());
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.queryByText(/private-token/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading projects' }));
    expect(await screen.findByText('Website Redesign')).toBeInTheDocument();
  });
});
