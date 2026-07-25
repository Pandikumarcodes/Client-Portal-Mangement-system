import { describe, expect, it, vi } from 'vitest';
import { getOrganizationDashboard } from '../../../src/modules/dashboard/dashboard.service.js';

describe('dashboard service', () => {
  it('passes tenant scope once and maps every approved status into a safe frozen DTO', async () => {
    const repositoryResult = {
      clients: { total: 2, statuses: { active: 1, inactive: 1, unexpected: 90 } },
      projects: {
        total: 4,
        statuses: { active: 1, on_hold: 1, completed: 1, archived: 1, private: 90 },
      },
      milestones: {
        total: 3,
        statuses: { pending: 1, in_progress: 1, completed: 1, private: 90 },
      },
      files: { total: 2, statuses: { active: 1, archived: 1, private: 90 } },
      invoices: {
        total: 4,
        statuses: { draft: 1, sent: 1, paid: 1, void: 1, overdue: 90 },
      },
    };
    const getOrganizationDashboardCounts = vi.fn().mockResolvedValue({
      ...repositoryResult,
    });

    const result = await getOrganizationDashboard(
      { tenantId: 'tenant-id' },
      { getOrganizationDashboardCounts },
    );

    expect(getOrganizationDashboardCounts).toHaveBeenCalledWith({ tenantId: 'tenant-id' });
    expect(getOrganizationDashboardCounts).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      clients: { total: 2, active: 1, inactive: 1 },
      projects: { total: 4, active: 1, onHold: 1, completed: 1, archived: 1 },
      milestones: { total: 3, pending: 1, inProgress: 1, completed: 1 },
      files: { total: 2, active: 1, archived: 1 },
      invoices: { total: 4, draft: 1, sent: 1, paid: 1, void: 1 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    for (const value of Object.values(result)) expect(Object.isFrozen(value)).toBe(true);
    expect(result).not.toHaveProperty('tenantId');
    expect(JSON.stringify(result)).not.toContain('unexpected');
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('overdue');
    expect(repositoryResult).toEqual({
      clients: { total: 2, statuses: { active: 1, inactive: 1, unexpected: 90 } },
      projects: {
        total: 4,
        statuses: { active: 1, on_hold: 1, completed: 1, archived: 1, private: 90 },
      },
      milestones: {
        total: 3,
        statuses: { pending: 1, in_progress: 1, completed: 1, private: 90 },
      },
      files: { total: 2, statuses: { active: 1, archived: 1, private: 90 } },
      invoices: {
        total: 4,
        statuses: { draft: 1, sent: 1, paid: 1, void: 1, overdue: 90 },
      },
    });
  });

  it('normalizes missing, non-finite, non-numeric, and fractional counts without exposing NaN', async () => {
    const dependency = vi.fn().mockResolvedValue({
      clients: { statuses: { active: Number.NaN, inactive: '2' } },
      projects: { total: 4.9, statuses: { active: Number.POSITIVE_INFINITY } },
      milestones: {},
      files: {},
      invoices: {},
    });

    const result = await getOrganizationDashboard(
      { tenantId: 'tenant-id' },
      { getOrganizationDashboardCounts: dependency },
    );

    expect(result.clients.total).toBe(0);
    expect(result.clients.active).toBe(0);
    expect(result.clients.inactive).toBe(0);
    expect(result.projects.total).toBe(4);
    expect(JSON.stringify(result)).not.toContain('NaN');
    for (const dashboardSection of Object.values(result)) {
      for (const value of Object.values(dashboardSection)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rejects negative counts instead of silently accepting them', async () => {
    const dependency = vi.fn().mockResolvedValue({
      clients: { total: -1 },
    });

    await expect(
      getOrganizationDashboard(
        { tenantId: 'tenant-id' },
        { getOrganizationDashboardCounts: dependency },
      ),
    ).rejects.toThrow(RangeError);
  });

  it('rejects missing tenant context before calling the repository', async () => {
    const dependency = vi.fn();

    await expect(
      getOrganizationDashboard({ tenantId: '' }, { getOrganizationDashboardCounts: dependency }),
    ).rejects.toThrow(TypeError);
    expect(dependency).not.toHaveBeenCalled();
  });

  it('rejects an invalid repository result and propagates dependency failures unchanged', async () => {
    const dependency = vi.fn().mockResolvedValue(null);

    await expect(
      getOrganizationDashboard(
        { tenantId: 'tenant-id' },
        { getOrganizationDashboardCounts: dependency },
      ),
    ).rejects.toThrow(TypeError);

    const failure = new Error('repository failure');
    dependency.mockRejectedValue(failure);
    await expect(
      getOrganizationDashboard(
        { tenantId: 'tenant-id' },
        { getOrganizationDashboardCounts: dependency },
      ),
    ).rejects.toBe(failure);
  });
});
