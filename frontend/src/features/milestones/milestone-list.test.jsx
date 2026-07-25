import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../auth/auth-context.js';

const api = vi.hoisted(() => ({ listMilestones: vi.fn() }));
vi.mock('./milestone-api.js', () => ({ listMilestones: api.listMilestones }));
import { MilestoneList } from './milestone-list.jsx';

const milestone = {
  id: 'milestone-1',
  projectId: 'project-1',
  title: 'Design approval',
  description: null,
  dueDate: null,
  status: 'in_progress',
  createdAt: '2026-07-01T00:00:00.000Z',
  tenantId: 'hidden-tenant',
};
const result = (milestones = [milestone], page = 1, totalPages = 2) => ({
  milestones,
  pagination: { page, limit: 20, total: milestones.length, totalPages },
});

function renderList() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter>
        <MilestoneList projectId="project-1" />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  api.listMilestones.mockReset();
  api.listMilestones.mockResolvedValue(result());
});

describe('MilestoneList', () => {
  it('shows loading then renders safe content and readable fallbacks', async () => {
    renderList();
    expect(screen.getByRole('status')).toHaveTextContent('Loading milestones');
    expect(await screen.findByText('Design approval')).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('In progress')).toBeInTheDocument();
    expect(table.getByText('No due date')).toBeInTheDocument();
    expect(table.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.queryByText('hidden-tenant')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/projects/project-1/milestones/milestone-1',
    );
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders unfiltered and filtered empty states', async () => {
    api.listMilestones.mockResolvedValue(result([], 1, 0));
    renderList();
    expect(await screen.findByText('This project has no milestones yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    expect(await screen.findByText('No milestones match the selected status.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear status filter' }));
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('updates the status request, resets to page 1, and paginates', async () => {
    renderList();
    await screen.findByText('Design approval');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(api.listMilestones).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', page: 2, limit: 20 }),
      'memory-token',
    ));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    await waitFor(() => expect(api.listMilestones).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, status: 'completed' }),
      'memory-token',
    ));
    api.listMilestones.mockResolvedValue(result([milestone], 1, 1));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled());
  });

  it('shows a safe retryable error', async () => {
    api.listMilestones
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'private data' })
      .mockResolvedValueOnce(result());
    renderList();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.queryByText('private data')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading milestones' }));
    expect(await screen.findByText('Design approval')).toBeInTheDocument();
  });
});
