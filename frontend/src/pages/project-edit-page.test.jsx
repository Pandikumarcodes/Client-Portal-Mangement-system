import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({
  listClients: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock('../features/clients/client-api.js', () => ({ listClients: api.listClients }));
vi.mock('../features/projects/project-api.js', () => ({
  getProject: api.getProject,
  updateProject: api.updateProject,
}));
import { ProjectEditPage } from './project-edit-page.jsx';

const project = {
  id: 'project-1',
  clientId: 'client-1',
  name: 'Website Redesign',
  description: 'Original copy',
  status: 'active',
};
const client = { id: 'client-1', firstName: 'Ada', lastName: 'Lovelace' };

function renderPage() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={['/projects/project-1/edit']}>
        <Routes>
          <Route path="/projects/:projectId/edit" element={<ProjectEditPage />} />
          <Route path="/projects/:projectId" element={<div>Project destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getProject.mockResolvedValue(project);
  api.listClients.mockResolvedValue({ clients: [client], pagination: { totalPages: 1 } });
  api.updateProject.mockResolvedValue(project);
});

describe('ProjectEditPage', () => {
  it('loads the Project and Client options and prepopulates editable values', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading project');
    expect(await screen.findByLabelText('Project name')).toHaveValue('Website Redesign');
    expect(screen.getByLabelText('Client')).toHaveValue('client-1');
    expect(screen.getByLabelText('Description')).toHaveValue('Original copy');
    expect(screen.getByLabelText('Status')).toHaveValue('active');
    expect(screen.queryByLabelText(/tenant/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('submits supported edits including archived status and navigates', async () => {
    api.updateProject.mockResolvedValue({ ...project, status: 'archived' });
    renderPage();
    await screen.findByLabelText('Project name');
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Updated Website' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateProject).toHaveBeenCalledWith(
      'project-1',
      {
        clientId: 'client-1',
        name: 'Updated Website',
        description: null,
        status: 'archived',
      },
      'memory-token',
    ));
    expect(api.updateProject.mock.calls[0][1]).not.toHaveProperty('tenantId');
    expect(await screen.findByText('Project destination')).toBeInTheDocument();
  });

  it('handles CLIENT_NOT_FOUND safely and preserves edits', async () => {
    api.updateProject.mockRejectedValue({ code: 'CLIENT_NOT_FOUND', message: 'private' });
    renderPage();
    await screen.findByLabelText('Project name');
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Preserved edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('selected client is unavailable');
    expect(screen.getByLabelText('Project name')).toHaveValue('Preserved edit');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });

  it('handles PROJECT_NOT_FOUND during initial loading', async () => {
    api.getProject.mockRejectedValue({ code: 'PROJECT_NOT_FOUND' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('The project was not found.');
  });
});
