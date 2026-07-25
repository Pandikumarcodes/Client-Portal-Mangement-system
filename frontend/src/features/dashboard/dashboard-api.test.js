import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('../../core/api/api-client.js', () => ({ apiRequest }));

import * as dashboardApi from './dashboard-api.js';

const token = 'memory-token';
const dashboard = {
  clients: { total: 1, active: 1, inactive: 0 },
  projects: { total: 0, active: 0, onHold: 0, completed: 0, archived: 0 },
  milestones: { total: 0, pending: 0, inProgress: 0, completed: 0 },
  files: { total: 0, active: 0, archived: 0 },
  invoices: { total: 0, draft: 0, sent: 0, paid: 0, void: 0 },
};

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({ success: true, data: { dashboard } });
  localStorage.clear();
  sessionStorage.clear();
});

describe('getOrganizationDashboard', () => {
  it('uses the authenticated GET endpoint without a body, tenant, or query parameters', async () => {
    await expect(dashboardApi.getOrganizationDashboard({}, token)).resolves.toEqual(dashboard);
    expect(apiRequest).toHaveBeenCalledWith('/dashboard/organization', {
      method: 'GET',
      accessToken: token,
    });
    expect(apiRequest.mock.calls[0][0]).not.toContain('?');
    expect(apiRequest.mock.calls[0][1]).not.toHaveProperty('body');
    expect(JSON.stringify(apiRequest.mock.calls[0])).not.toContain('tenantId');
  });

  it('forwards an AbortSignal', async () => {
    const controller = new AbortController();
    await dashboardApi.getOrganizationDashboard({ signal: controller.signal }, token);
    expect(apiRequest).toHaveBeenCalledWith('/dashboard/organization', {
      method: 'GET',
      accessToken: token,
      signal: controller.signal,
    });
  });

  it('normalizes missing approved counts while excluding unexpected fields', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        dashboard: {
          clients: { total: 2, tenantId: 'hidden', repositoryVersion: 4 },
          unexpectedSection: { total: 99 },
        },
      },
    });
    const result = await dashboardApi.getOrganizationDashboard({}, token);
    expect(result.clients).toEqual({ total: 2, active: 0, inactive: 0 });
    expect(result.tenantId).toBeUndefined();
    expect(result.unexpectedSection).toBeUndefined();
  });

  it('propagates safe request errors unchanged', async () => {
    const error = { code: 'FORBIDDEN', message: 'Forbidden.' };
    apiRequest.mockRejectedValue(error);
    await expect(dashboardApi.getOrganizationDashboard({}, token)).rejects.toBe(error);
  });

  it.each([
    undefined,
    null,
    {},
    { success: false, data: { dashboard } },
    { success: true, data: {} },
    { success: true, data: { dashboard: null } },
  ])('rejects malformed success envelopes', async (response) => {
    apiRequest.mockResolvedValue(response);
    await expect(dashboardApi.getOrganizationDashboard({}, token)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('does not turn request failure into a zero dashboard', async () => {
    apiRequest.mockRejectedValue({ code: 'NETWORK_ERROR' });
    await expect(dashboardApi.getOrganizationDashboard({}, token)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('requires an in-memory access token', async () => {
    await expect(dashboardApi.getOrganizationDashboard({}, '')).rejects.toThrow('access token');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('exports only the Organization Admin read function and uses no browser storage', () => {
    expect(Object.keys(dashboardApi)).toEqual(['getOrganizationDashboard']);
    expect(dashboardApi.getClientDashboard).toBeUndefined();
    expect(dashboardApi.getSuperAdminDashboard).toBeUndefined();
    expect(dashboardApi.createDashboard).toBeUndefined();
    expect(dashboardApi.updateDashboard).toBeUndefined();
    expect(dashboardApi.deleteDashboard).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
