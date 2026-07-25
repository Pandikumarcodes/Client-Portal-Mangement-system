import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context.js';

const api = vi.hoisted(() => ({
  listProjectFiles: vi.fn(),
  downloadProjectFile: vi.fn(),
}));
vi.mock('./project-file-api.js', () => api);
import { ProjectFileList } from './project-file-list.jsx';

const file = {
  id: 'file-1',
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1536,
  description: null,
  status: 'archived',
  createdAt: '2026-07-01T00:00:00.000Z',
  tenantId: 'hidden-tenant',
  storedName: 'hidden-name',
  storagePath: 'hidden/path',
};
const result = (files = [file], page = 1, totalPages = 2) => ({
  files,
  pagination: { page, limit: 20, total: files.length, totalPages },
});

function renderList() {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter><ProjectFileList projectId="project-1" /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  api.listProjectFiles.mockReset();
  api.downloadProjectFile.mockReset();
  api.listProjectFiles.mockResolvedValue(result());
  api.downloadProjectFile.mockResolvedValue('proposal.pdf');
});

describe('ProjectFileList', () => {
  it('renders safe readable metadata, actions, and no deferred features', async () => {
    renderList();
    expect(screen.getByRole('status')).toHaveTextContent('Loading files');
    expect(await screen.findByText('proposal.pdf')).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText(/PDF/)).toHaveTextContent('1.5 KiB');
    expect(table.getByText('Archived')).toBeInTheDocument();
    expect(table.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/projects/project-1/files/file-1',
    );
    expect(screen.getByRole('button', { name: 'Download proposal.pdf' })).toBeInTheDocument();
    expect(screen.queryByText(/hidden-tenant|hidden-name|hidden\/path/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|replace|preview/i })).not.toBeInTheDocument();
  });

  it('renders empty states, filters, and backend pagination', async () => {
    api.listProjectFiles.mockResolvedValue(result([], 1, 0));
    renderList();
    expect(await screen.findByText('This project has no files yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
    expect(await screen.findByText('No files match the selected status.')).toBeInTheDocument();
    expect(api.listProjectFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, status: 'archived', limit: 20 }),
      'memory-token',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear status filter' }));
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('paginates and downloads through the feature API', async () => {
    renderList();
    await screen.findByText('proposal.pdf');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(api.listProjectFiles).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
      'memory-token',
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Download proposal.pdf' }));
    await waitFor(() => expect(api.downloadProjectFile).toHaveBeenCalledWith({
      projectId: 'project-1',
      fileId: 'file-1',
      fallbackName: 'proposal.pdf',
    }, 'memory-token'));
  });

  it('renders safe retryable list and download errors', async () => {
    api.listProjectFiles
      .mockRejectedValueOnce({ code: 'NETWORK_ERROR', message: 'private' })
      .mockResolvedValueOnce(result());
    renderList();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading files' }));
    await screen.findByText('proposal.pdf');
    api.downloadProjectFile.mockRejectedValue({ code: 'PROJECT_FILE_CONTENT_NOT_FOUND' });
    fireEvent.click(screen.getByRole('button', { name: 'Download proposal.pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('content is unavailable');
  });
});
