import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({ listClients: vi.fn(), getProject: vi.fn() }));
vi.mock('../features/clients/client-api.js', () => ({ listClients: api.listClients }));
vi.mock('../features/projects/project-api.js', () => ({ getProject: api.getProject }));
import { ProjectDetailPage } from './project-detail-page.jsx';

const project = {
  id: 'project-1',
  clientId: 'client-1',
  name: 'Website Redesign',
  description: null,
  status: 'on_hold',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  tenantId: 'hidden-tenant',
};
const client = { id: 'client-1', firstName: 'Ada', lastName: 'Lovelace' };

function renderPage() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={['/projects/project-1']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  api.getProject.mockReset();
  api.listClients.mockReset();
  api.getProject.mockResolvedValue(project);
  api.listClients.mockResolvedValue({ clients: [client], pagination: { totalPages: 1 } });
});

describe('ProjectDetailPage', () => {
  it('loads and renders safe details with readable Client and status labels', async () => {
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading project');
    expect(await screen.findByRole('heading', { name: 'Website Redesign' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('On hold')).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Project' })).toHaveAttribute(
      'href',
      '/projects/project-1/edit',
    );
    expect(screen.getByRole('link', { name: 'Back to Projects' })).toHaveAttribute('href', '/projects');
  });

  it('does not render deferred sections or deletion', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Website Redesign' });
    expect(screen.queryByText(/milestones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/files/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invoices/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('handles PROJECT_NOT_FOUND without exposing raw errors', async () => {
    api.getProject.mockRejectedValue({ code: 'PROJECT_NOT_FOUND', message: 'private data' });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('The project was not found.');
    expect(screen.queryByText('private data')).not.toBeInTheDocument();
  });
});
