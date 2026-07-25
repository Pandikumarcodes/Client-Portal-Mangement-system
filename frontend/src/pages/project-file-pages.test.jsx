import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../features/auth/auth-context.js';

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  uploadProjectFile: vi.fn(),
  getProjectFile: vi.fn(),
  updateProjectFile: vi.fn(),
  downloadProjectFile: vi.fn(),
}));
vi.mock('../features/projects/project-api.js', () => ({ getProject: api.getProject }));
vi.mock('../features/project-files/project-file-api.js', () => ({
  uploadProjectFile: api.uploadProjectFile,
  getProjectFile: api.getProjectFile,
  updateProjectFile: api.updateProjectFile,
  downloadProjectFile: api.downloadProjectFile,
}));
import { ProjectFileDetailPage } from './project-file-detail-page.jsx';
import { ProjectFileEditPage } from './project-file-edit-page.jsx';
import { ProjectFileUploadPage } from './project-file-upload-page.jsx';

const project = { id: 'project-1', name: 'Website Redesign' };
const projectFile = {
  id: 'file-1',
  projectId: 'project-1',
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1536,
  description: null,
  status: 'archived',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  tenantId: 'hidden-tenant',
  storedName: 'hidden-name',
  storagePath: 'hidden/path',
};

function renderPage(path, route, element) {
  render(
    <AuthContext.Provider value={{ accessToken: 'memory-token', clearSession: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route path="/projects/:projectId/files/:fileId" element={<div>File destination</div>} />
          <Route path="/login" element={<div>Login destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.getProject.mockResolvedValue(project);
  api.getProjectFile.mockResolvedValue(projectFile);
  api.uploadProjectFile.mockResolvedValue(projectFile);
  api.updateProjectFile.mockResolvedValue(projectFile);
  api.downloadProjectFile.mockResolvedValue('proposal.pdf');
});

describe('ProjectFileUploadPage', () => {
  it('loads Project context and uploads only selected values with the route Project ID', async () => {
    renderPage(
      '/projects/project-1/files/new',
      '/projects/:projectId/files/new',
      <ProjectFileUploadPage />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading project');
    expect(await screen.findByRole('link', { name: 'Website Redesign' })).toBeInTheDocument();
    const selected = new File(['pdf'], 'proposal.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [selected] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
    await waitFor(() => expect(api.uploadProjectFile).toHaveBeenCalledWith({
      projectId: 'project-1',
      file: selected,
      description: undefined,
    }, 'memory-token'));
    expect(api.uploadProjectFile.mock.calls[0][0]).not.toHaveProperty('tenantId');
    expect(api.uploadProjectFile.mock.calls[0][0]).not.toHaveProperty('status');
    expect(await screen.findByText('File destination')).toBeInTheDocument();
  });

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['PROJECT_FILE_TYPE_NOT_ALLOWED', 'supported PDF'],
    ['PROJECT_FILE_TOO_LARGE', '10 MiB'],
    ['PROJECT_FILE_UPLOAD_INVALID', 'could not be accepted'],
  ])('handles %s safely', async (code, expected) => {
    if (code === 'PROJECT_NOT_FOUND') api.getProject.mockRejectedValue({ code, message: 'private' });
    else api.uploadProjectFile.mockRejectedValue({ code, message: 'private' });
    renderPage(
      '/projects/project-1/files/new',
      '/projects/:projectId/files/new',
      <ProjectFileUploadPage />,
    );
    if (code === 'PROJECT_NOT_FOUND') {
      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    } else {
      await screen.findByLabelText('File');
      fireEvent.change(screen.getByLabelText('File'), {
        target: { files: [new File(['pdf'], 'proposal.pdf', { type: 'application/pdf' })] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Upload File' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
    }
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});

describe('ProjectFileDetailPage', () => {
  it('renders safe metadata, Project context, download, and no deferred actions', async () => {
    renderPage(
      '/projects/project-1/files/file-1',
      '/projects/:projectId/files/:fileId',
      <ProjectFileDetailPage />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading file');
    expect(await screen.findByRole('heading', { name: 'proposal.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Website Redesign' })).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('1.5 KiB')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit metadata' })).toHaveAttribute(
      'href',
      '/projects/project-1/files/file-1/edit',
    );
    expect(screen.getByRole('link', { name: 'Back to Project' })).toBeInTheDocument();
    expect(screen.queryByText(/hidden-tenant|hidden-name|hidden\/path/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete|replace|preview/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download proposal.pdf' }));
    await waitFor(() => expect(api.downloadProjectFile).toHaveBeenCalledWith({
      projectId: 'project-1',
      fileId: 'file-1',
      fallbackName: 'proposal.pdf',
    }, 'memory-token'));
  });

  it.each([
    ['PROJECT_NOT_FOUND', 'The project was not found.'],
    ['PROJECT_FILE_NOT_FOUND', 'The project file was not found.'],
  ])('handles %s safely', async (code, message) => {
    api.getProjectFile.mockRejectedValue({ code });
    renderPage(
      '/projects/project-1/files/file-1',
      '/projects/:projectId/files/:fileId',
      <ProjectFileDetailPage />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('handles unavailable binary content safely', async () => {
    api.downloadProjectFile.mockRejectedValue({ code: 'PROJECT_FILE_CONTENT_NOT_FOUND' });
    renderPage(
      '/projects/project-1/files/file-1',
      '/projects/:projectId/files/:fileId',
      <ProjectFileDetailPage />,
    );
    await screen.findByRole('heading', { name: 'proposal.pdf' });
    fireEvent.click(screen.getByRole('button', { name: 'Download proposal.pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('content is unavailable');
  });
});

describe('ProjectFileEditPage', () => {
  it('prepopulates supported metadata and submits clearing plus restore', async () => {
    renderPage(
      '/projects/project-1/files/file-1/edit',
      '/projects/:projectId/files/:fileId/edit',
      <ProjectFileEditPage />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading file');
    expect(await screen.findByText('proposal.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('archived');
    expect(screen.queryByLabelText('File')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tenant|project id|stored|storage|original name/i))
      .not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateProjectFile).toHaveBeenCalledWith({
      projectId: 'project-1',
      fileId: 'file-1',
      updates: { description: null, status: 'active' },
    }, 'memory-token'));
    expect(await screen.findByText('File destination')).toBeInTheDocument();
  });

  it('preserves edits after a safe API error', async () => {
    api.updateProjectFile.mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'private' });
    renderPage(
      '/projects/project-1/files/file-1/edit',
      '/projects/:projectId/files/:fileId/edit',
      <ProjectFileEditPage />,
    );
    await screen.findByLabelText('Description');
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Preserved notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the file information');
    expect(screen.getByLabelText('Description')).toHaveValue('Preserved notes');
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});
