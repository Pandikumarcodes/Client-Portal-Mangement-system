import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  createMilestone: vi.fn(),
  getMilestone: vi.fn(),
  updateMilestone: vi.fn(),
}));
vi.mock('../features/projects/project-api.js', () => ({ getProject: api.getProject }));
vi.mock('../features/milestones/milestone-api.js', () => ({
  createMilestone: api.createMilestone,
  getMilestone: api.getMilestone,
  updateMilestone: api.updateMilestone,
}));
import { MilestoneCreatePage } from './milestone-create-page.jsx';
import { MilestoneDetailPage } from './milestone-detail-page.jsx';
import { MilestoneEditPage } from './milestone-edit-page.jsx';

const project = { id: 'project-1', name: 'Website Redesign' };
const milestone = {
  id: 'milestone-1',
  projectId: 'project-1',
  title: 'Design approval',
  description: 'Client review',
  dueDate: '2026-08-15T00:00:00.000Z',
  status: 'pending',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  tenantId: 'hidden-tenant',
};

function renderPage(path, element, route) {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route
            path="/projects/:projectId/milestones/:milestoneId"
            element={<div>Milestone destination</div>}
          />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getProject.mockResolvedValue(project);
  api.getMilestone.mockResolvedValue(milestone);
  api.createMilestone.mockResolvedValue(milestone);
  api.updateMilestone.mockResolvedValue(milestone);
});

describe('MilestoneCreatePage', () => {
  it('loads Project context and creates without status or tenant fields', async () => {
    renderPage(
      '/projects/project-1/milestones/new',
      <MilestoneCreatePage />,
      '/projects/:projectId/milestones/new',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading project');
    expect(await screen.findByRole('link', { name: 'Website Redesign' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Approval' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Milestone' }));
    await waitFor(() => expect(api.createMilestone).toHaveBeenCalledWith({
      projectId: 'project-1',
      title: 'Approval',
    }, 'memory-token'));
    expect(api.createMilestone.mock.calls[0][0]).not.toHaveProperty('tenantId');
    expect(api.createMilestone.mock.calls[0][0]).not.toHaveProperty('status');
    expect(await screen.findByText('Milestone destination')).toBeInTheDocument();
  });

  it('handles PROJECT_NOT_FOUND safely', async () => {
    api.getProject.mockRejectedValue({ code: 'PROJECT_NOT_FOUND', message: 'private' });
    renderPage(
      '/projects/project-1/milestones/new',
      <MilestoneCreatePage />,
      '/projects/:projectId/milestones/new',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('The project was not found.');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});

describe('MilestoneDetailPage', () => {
  it('renders safe details, Project context, links, and no deferred actions', async () => {
    renderPage(
      '/projects/project-1/milestones/milestone-1',
      <MilestoneDetailPage />,
      '/projects/:projectId/milestones/:milestoneId',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading milestone');
    expect(await screen.findByRole('heading', { name: 'Design approval' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website Redesign' })).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Client review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Milestone' })).toHaveAttribute(
      'href',
      '/projects/project-1/milestones/milestone-1/edit',
    );
    expect(screen.getByRole('link', { name: 'Back to Project' })).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.queryByText(/comments|tasks|files/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['MILESTONE_NOT_FOUND', 'The milestone was not found.'],
  ])('handles %s safely', async (code, message) => {
    api.getMilestone.mockRejectedValue({ code });
    renderPage(
      '/projects/project-1/milestones/milestone-1',
      <MilestoneDetailPage />,
      '/projects/:projectId/milestones/:milestoneId',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});

describe('MilestoneEditPage', () => {
  it('prepopulates all fields and submits status and clearing updates', async () => {
    renderPage(
      '/projects/project-1/milestones/milestone-1/edit',
      <MilestoneEditPage />,
      '/projects/:projectId/milestones/:milestoneId/edit',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading milestone');
    expect(await screen.findByLabelText('Title')).toHaveValue('Design approval');
    expect(screen.getByLabelText('Description')).toHaveValue('Client review');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-08-15');
    expect(screen.getByLabelText('Status')).toHaveValue('pending');
    expect(screen.queryByLabelText(/tenant|project id/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateMilestone).toHaveBeenCalledWith({
      projectId: 'project-1',
      milestoneId: 'milestone-1',
      updates: { description: null, dueDate: null, status: 'completed' },
    }, 'memory-token'));
    expect(api.updateMilestone.mock.calls[0][0].updates).not.toHaveProperty('projectId');
    expect(await screen.findByText('Milestone destination')).toBeInTheDocument();
  });

  it('preserves edits after a safe server error', async () => {
    api.updateMilestone.mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'private' });
    renderPage(
      '/projects/project-1/milestones/milestone-1/edit',
      <MilestoneEditPage />,
      '/projects/:projectId/milestones/:milestoneId/edit',
    );
    await screen.findByLabelText('Title');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Preserved edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the milestone information');
    expect(screen.getByLabelText('Title')).toHaveValue('Preserved edit');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});
