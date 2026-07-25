import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));

import * as projectApi from './project-api.js';

const token = 'memory-token';
const project = { id: 'project-1', name: 'Website' };
const response = { success: true, data: { project, projects: [project], pagination: { page: 1 } } };

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(response);
});

describe('Project API operations', () => {
  it('lists with pagination and omits empty filters', async () => {
    await expect(projectApi.listProjects({ page: 1, limit: 20, status: '', clientId: '' }, token))
      .resolves.toEqual({ projects: [project], pagination: { page: 1 } });
    expect(apiRequest).toHaveBeenCalledWith('/projects?page=1&limit=20', {
      accessToken: token,
    });
  });

  it('includes safely encoded status and Client filters', async () => {
    await projectApi.listProjects({
      page: 2,
      limit: 20,
      status: 'on_hold',
      clientId: 'client/id',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects?page=2&limit=20&status=on_hold&clientId=client%2Fid',
      { accessToken: token },
    );
  });

  it('forwards an AbortSignal', async () => {
    const controller = new AbortController();
    await projectApi.listProjects({ signal: controller.signal }, token);
    expect(apiRequest.mock.calls[0][1].signal).toBe(controller.signal);
    apiRequest.mockClear();
    await projectApi.getProject('project-1', token, controller.signal);
    expect(apiRequest.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('creates with supported fields only and omits blank description', async () => {
    await projectApi.createProject({
      clientId: 'client-1',
      name: 'Website',
      description: '   ',
      status: 'archived',
      tenantId: 'hidden',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith('/projects', {
      method: 'POST',
      body: { clientId: 'client-1', name: 'Website' },
      accessToken: token,
    });
  });

  it('includes a nonblank create description without status or tenantId', async () => {
    await projectApi.createProject({
      clientId: 'client-1',
      name: 'Website',
      description: 'Redesign',
      status: 'completed',
      tenantId: 'hidden',
    }, token);
    expect(apiRequest.mock.calls[0][1].body).toEqual({
      clientId: 'client-1',
      name: 'Website',
      description: 'Redesign',
    });
  });

  it('gets an encoded Project ID path', async () => {
    await projectApi.getProject('project/id', token);
    expect(apiRequest).toHaveBeenCalledWith('/projects/project%2Fid', { accessToken: token });
  });

  it('updates with PATCH and only supported fields', async () => {
    await projectApi.updateProject('project/id', {
      clientId: 'client-2',
      name: 'New name',
      description: null,
      status: 'archived',
      tenantId: 'hidden',
      progress: 50,
      createdAt: 'hidden',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith('/projects/project%2Fid', {
      method: 'PATCH',
      body: {
        clientId: 'client-2',
        name: 'New name',
        description: null,
        status: 'archived',
      },
      accessToken: token,
    });
  });

  it('propagates safe API errors', async () => {
    const error = { code: 'PROJECT_NOT_FOUND' };
    apiRequest.mockRejectedValue(error);
    await expect(projectApi.getProject('missing', token)).rejects.toBe(error);
  });

  it('rejects malformed success responses', async () => {
    apiRequest.mockResolvedValue({ success: true, data: {} });
    await expect(projectApi.listProjects({}, token)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    await expect(projectApi.createProject({}, token)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('requires the in-memory access token for every operation', async () => {
    await expect(projectApi.createProject({}, '')).rejects.toThrow('access token');
    await expect(projectApi.listProjects({}, null)).rejects.toThrow('access token');
    await expect(projectApi.getProject('id', undefined)).rejects.toThrow('access token');
    await expect(projectApi.updateProject('id', {}, ' ')).rejects.toThrow('access token');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not expose a delete operation or use browser storage', () => {
    expect(projectApi.deleteProject).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
