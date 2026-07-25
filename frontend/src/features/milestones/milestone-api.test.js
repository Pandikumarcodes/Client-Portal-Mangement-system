import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));

import * as milestoneApi from './milestone-api.js';

const token = 'memory-token';
const milestone = {
  id: 'milestone-1',
  projectId: 'project-1',
  title: 'Approval',
  status: 'pending',
};
const singleResponse = { success: true, data: { milestone } };
const listResponse = {
  success: true,
  data: {
    milestones: [milestone],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
};

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue(singleResponse);
});

describe('Milestone API operations', () => {
  it('lists through the nested Project endpoint with pagination and status', async () => {
    apiRequest.mockResolvedValue(listResponse);
    await expect(milestoneApi.listMilestones({
      projectId: 'project/id',
      page: 2,
      limit: 20,
      status: 'in_progress',
    }, token)).resolves.toEqual({
      milestones: [milestone],
      pagination: listResponse.data.pagination,
    });
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project%2Fid/milestones?page=2&limit=20&status=in_progress',
      { accessToken: token },
    );
  });

  it('omits a blank status and forwards an AbortSignal', async () => {
    apiRequest.mockResolvedValue(listResponse);
    const controller = new AbortController();
    await milestoneApi.listMilestones({
      projectId: 'project-1',
      status: ' ',
      signal: controller.signal,
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project-1/milestones?page=1&limit=20',
      { accessToken: token, signal: controller.signal },
    );
  });

  it('creates with POST and only supported nonblank fields', async () => {
    await milestoneApi.createMilestone({
      projectId: 'project-1',
      title: 'Approval',
      description: 'Client approval',
      dueDate: '2026-08-15T00:00:00.000Z',
      status: 'completed',
      tenantId: 'hidden',
    }, token);
    expect(apiRequest).toHaveBeenCalledWith('/projects/project-1/milestones', {
      method: 'POST',
      body: {
        title: 'Approval',
        description: 'Client approval',
        dueDate: '2026-08-15T00:00:00.000Z',
      },
      accessToken: token,
    });
  });

  it('omits blank optional create fields', async () => {
    await milestoneApi.createMilestone({
      projectId: 'project-1',
      title: 'Approval',
      description: ' ',
      dueDate: '',
    }, token);
    expect(apiRequest.mock.calls[0][1].body).toEqual({ title: 'Approval' });
  });

  it('gets using both encoded IDs and forwards its AbortSignal', async () => {
    const controller = new AbortController();
    await milestoneApi.getMilestone({
      projectId: 'project/id',
      milestoneId: 'milestone/id',
      signal: controller.signal,
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project%2Fid/milestones/milestone%2Fid',
      { accessToken: token, signal: controller.signal },
    );
  });

  it('updates with PATCH, only supported fields, and preserves clearing nulls', async () => {
    await milestoneApi.updateMilestone({
      projectId: 'project-1',
      milestoneId: 'milestone-1',
      updates: {
        title: 'Updated',
        description: null,
        dueDate: null,
        status: 'completed',
        projectId: 'hidden',
        tenantId: 'hidden',
        completedAt: 'hidden',
        progress: 100,
      },
    }, token);
    expect(apiRequest).toHaveBeenCalledWith(
      '/projects/project-1/milestones/milestone-1',
      {
        method: 'PATCH',
        body: {
          title: 'Updated',
          description: null,
          dueDate: null,
          status: 'completed',
        },
        accessToken: token,
      },
    );
  });

  it('propagates safe backend errors and rejects malformed successes', async () => {
    const error = { code: 'MILESTONE_NOT_FOUND' };
    apiRequest.mockRejectedValueOnce(error);
    await expect(milestoneApi.getMilestone({
      projectId: 'project-1',
      milestoneId: 'missing',
    }, token)).rejects.toBe(error);
    apiRequest.mockResolvedValueOnce({ success: true, data: {} });
    await expect(milestoneApi.createMilestone({
      projectId: 'project-1',
      title: 'Approval',
    }, token)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    apiRequest.mockResolvedValueOnce({ success: true, data: { milestones: [] } });
    await expect(milestoneApi.listMilestones({
      projectId: 'project-1',
    }, token)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('requires both nested IDs and the in-memory access token', async () => {
    await expect(milestoneApi.listMilestones({}, token)).rejects.toThrow('Project ID');
    await expect(milestoneApi.getMilestone({ projectId: 'project-1' }, token))
      .rejects.toThrow('Milestone ID');
    await expect(milestoneApi.createMilestone({ projectId: 'project-1' }, ' '))
      .rejects.toThrow('access token');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('does not export deletion or use browser storage', () => {
    expect(milestoneApi.deleteMilestone).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
