import { describe, expect, it } from 'vitest';
import { normalizeOrganizationDashboard } from './dashboard-normalization.js';

const completeDashboard = {
  clients: { total: 7, active: 5, inactive: 2 },
  projects: { total: 11, active: 4, onHold: 2, completed: 3, archived: 2 },
  milestones: { total: 8, pending: 2, inProgress: 3, completed: 3 },
  files: { total: 6, active: 5, archived: 1 },
  invoices: { total: 9, draft: 2, sent: 3, paid: 3, void: 1 },
};

describe('normalizeOrganizationDashboard', () => {
  it('returns the complete approved shape without mutating input', () => {
    const input = structuredClone(completeDashboard);
    const before = structuredClone(input);
    const result = normalizeOrganizationDashboard(input);
    expect(result).toEqual(completeDashboard);
    expect(input).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.values(result).every(Object.isFrozen)).toBe(true);
  });

  it('defaults missing sections and approved count fields to zero', () => {
    expect(normalizeOrganizationDashboard({ clients: { total: 0 } })).toEqual({
      clients: { total: 0, active: 0, inactive: 0 },
      projects: { total: 0, active: 0, onHold: 0, completed: 0, archived: 0 },
      milestones: { total: 0, pending: 0, inProgress: 0, completed: 0 },
      files: { total: 0, active: 0, archived: 0 },
      invoices: { total: 0, draft: 0, sent: 0, paid: 0, void: 0 },
    });
  });

  it('preserves positive integers, project onHold, and milestone inProgress', () => {
    const result = normalizeOrganizationDashboard(completeDashboard);
    expect(result.projects.onHold).toBe(2);
    expect(result.milestones.inProgress).toBe(3);
    expect(result.invoices.total).toBe(9);
  });

  it.each([
    ['numeric string', '2'],
    ['negative count', -1],
    ['decimal count', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
  ])('rejects a present invalid %s', (_label, value) => {
    expect(() => normalizeOrganizationDashboard({
      ...completeDashboard,
      clients: { ...completeDashboard.clients, total: value },
    })).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
  });

  it('excludes arbitrary, tenant, and repository-like fields', () => {
    const result = normalizeOrganizationDashboard({
      ...completeDashboard,
      tenantId: 'hidden-tenant',
      clients: {
        ...completeDashboard.clients,
        tenantId: 'hidden-tenant',
        deletedAt: 'internal',
        unexpected: 99,
      },
    });
    expect(result.tenantId).toBeUndefined();
    expect(result.clients).toEqual({ total: 7, active: 5, inactive: 2 });
    expect(result.clients.deletedAt).toBeUndefined();
    expect(result.clients.unexpected).toBeUndefined();
  });

  it.each([null, [], 'dashboard', 1])('rejects a malformed dashboard root', (value) => {
    expect(() => normalizeOrganizationDashboard(value)).toThrow(
      expect.objectContaining({ code: 'INVALID_RESPONSE' }),
    );
  });

  it.each([null, [], 'clients'])('rejects a present malformed section', (value) => {
    expect(() => normalizeOrganizationDashboard({ clients: value })).toThrow(
      expect.objectContaining({ code: 'INVALID_RESPONSE' }),
    );
  });
});
