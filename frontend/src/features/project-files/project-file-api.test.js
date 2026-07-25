import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));
import * as projectFileApi from './project-file-api.js';

const token = 'memory-token';
const file = {
  id: 'file-1',
  projectId: 'project-1',
  originalName: 'proposal.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 120,
  description: null,
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  tenantId: 'hidden',
  storedName: 'internal.pdf',
  storagePath: 'private/internal.pdf',
};

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({
    success: true,
    data: { file, files: [file], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
  });
});

describe('Project File API', () => {
  it('lists through the nested route and omits blank status', async () => {
    const result = await projectFileApi.listProjectFiles({
      projectId: 'project/id',
      page: 1,
      limit: 20,
      status: ' ',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project%2Fid/files?page=1&limit=20',
      { accessToken: token },
    );
    expect(result.files[0]).not.toHaveProperty('tenantId');
    expect(result.files[0]).not.toHaveProperty('storedName');
    expect(result.files[0]).not.toHaveProperty('storagePath');
  });

  it('includes supplied status and forwards AbortSignal', async () => {
    const controller = new AbortController();
    await projectFileApi.listProjectFiles({
      projectId: 'project-1',
      page: 2,
      limit: 20,
      status: 'archived',
      signal: controller.signal,
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project-1/files?page=2&limit=20&status=archived',
      { accessToken: token, signal: controller.signal },
    );
  });

  it('uploads FormData with only file and a trimmed optional description', async () => {
    const selected = new File(['pdf'], 'proposal.pdf', { type: 'application/pdf' });
    await projectFileApi.uploadProjectFile({
      projectId: 'project-1',
      file: selected,
      description: ' Notes ',
      tenantId: 'hidden',
      status: 'archived',
    }, token);
    const options = apiRequest.mock.calls[0][1];
    expect(apiRequest.mock.calls[0][0]).toBe('/projects/project-1/files');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(selected);
    expect(options.body.get('description')).toBe('Notes');
    expect(options.body.has('tenantId')).toBe(false);
    expect(options.body.has('projectId')).toBe(false);
    expect(options.body.has('status')).toBe(false);
    expect(options).not.toHaveProperty('headers');
  });

  it('omits a blank upload description', async () => {
    await projectFileApi.uploadProjectFile({
      projectId: 'project-1',
      file: new File(['pdf'], 'proposal.pdf', { type: 'application/pdf' }),
      description: ' ',
    }, token);
    expect(apiRequest.mock.calls[0][1].body.has('description')).toBe(false);
  });

  it('gets nested metadata and updates only supported fields with null preserved', async () => {
    await projectFileApi.getProjectFile({
      projectId: 'project/id',
      fileId: 'file/id',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project%2Fid/files/file%2Fid',
      { accessToken: token },
    );
    apiRequest.mockClear();
    await projectFileApi.updateProjectFile({
      projectId: 'project-1',
      fileId: 'file-1',
      updates: {
        description: null,
        status: 'archived',
        originalName: 'renamed.pdf',
        tenantId: 'hidden',
        storagePath: 'hidden',
      },
    }, token);
    expect(apiRequest).toHaveBeenCalledWith('/projects/project-1/files/file-1', {
      method: 'PATCH',
      body: { description: null, status: 'archived' },
      accessToken: token,
    });
  });

  it('downloads a Blob through authenticated fetch and cleans up temporary browser objects', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temporary');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    apiRequest.mockResolvedValue({
      data: new Blob(['pdf']),
      headers: new Headers({
        'Content-Disposition': 'attachment; filename="../safe.pdf"',
      }),
    });
    await expect(projectFileApi.downloadProjectFile({
      projectId: 'project-1',
      fileId: 'file-1',
      fallbackName: 'fallback.pdf',
    }, token)).resolves.toBe('_safe.pdf');
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project-1/files/file-1/download',
      { accessToken: token, responseType: 'blob' },
    );
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:temporary');
    expect(document.querySelector('a[href="blob:temporary"]')).not.toBeInTheDocument();
  });

  it('rejects malformed responses and exposes no destructive or public operation', async () => {
    apiRequest.mockResolvedValue({ success: true, data: {} });
    await expect(projectFileApi.getProjectFile({
      projectId: 'project-1',
      fileId: 'file-1',
    }, token)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(projectFileApi.deleteProjectFile).toBeUndefined();
    expect(projectFileApi.createPublicProjectFileUrl).toBeUndefined();
  });
});
