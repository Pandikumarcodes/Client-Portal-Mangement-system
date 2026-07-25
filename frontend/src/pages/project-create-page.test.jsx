import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({ listClients: vi.fn(), createProject: vi.fn() }));
vi.mock('../features/clients/client-api.js', () => ({ listClients: api.listClients }));
vi.mock('../features/projects/project-api.js', () => ({ createProject: api.createProject }));
import { ProjectCreatePage } from './project-create-page.jsx';

const client = { id: 'client-1', firstName: 'Ada', lastName: 'Lovelace' };

function renderPage() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route path="/projects/new" element={<ProjectCreatePage />} />
          <Route path="/projects/:projectId" element={<div>Project destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  api.listClients.mockReset();
  api.createProject.mockReset();
  api.listClients.mockResolvedValue({
    clients: [client],
    pagination: { page: 1, totalPages: 1 },
  });
  api.createProject.mockResolvedValue({ id: 'project/id' });
});

describe('ProjectCreatePage', () => {
  it('loads Client options and renders the create form', async () => {
    renderPage();
    expect(await screen.findByRole('option', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(api.listClients).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 }),
      'memory-token',
    );
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/projects');
  });

  it('handles no Clients with a Create Client link', async () => {
    api.listClients.mockResolvedValue({ clients: [], pagination: { totalPages: 0 } });
    renderPage();
    expect(await screen.findByText('A client must exist before you can create a project.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Client' })).toHaveAttribute('href', '/admin/clients/new');
    expect(screen.queryByRole('button', { name: 'Create Project' })).not.toBeInTheDocument();
  });

  it('creates supported data and navigates to details', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Website' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith({
      clientId: 'client-1',
      name: 'Website',
      description: undefined,
    }, 'memory-token'));
    expect(api.createProject.mock.calls[0][0]).not.toHaveProperty('tenantId');
    expect(await screen.findByText('Project destination')).toBeInTheDocument();
  });

  it('prevents invalid and duplicate submissions', async () => {
    api.createProject.mockReturnValue(new Promise(() => {}));
    renderPage();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(api.createProject).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Website' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(screen.getByRole('button', { name: 'Creating Project...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Creating Project...' }));
    expect(api.createProject).toHaveBeenCalledTimes(1);
  });

  it('shows CLIENT_NOT_FOUND safely and preserves values', async () => {
    api.createProject.mockRejectedValue({ code: 'CLIENT_NOT_FOUND', message: 'private' });
    renderPage();
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Website' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('selected client is unavailable');
    expect(screen.getByLabelText('Project name')).toHaveValue('Website');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});
