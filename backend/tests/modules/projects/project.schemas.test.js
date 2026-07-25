import { describe, expect, it } from 'vitest';

import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from '../../../src/modules/projects/project.schemas.js';

const mixedCaseId = 'ABCDEFabcdef123456789012';
const normalizedId = 'abcdefabcdef123456789012';

describe('Project request schemas', () => {
  it('normalizes valid create input with optional and blank descriptions', () => {
    expect(
      createProjectSchema.parse({
        clientId: mixedCaseId,
        name: '  Portal redesign  ',
        description: '  Delivery scope  ',
      }),
    ).toEqual({
      clientId: normalizedId,
      name: 'Portal redesign',
      description: 'Delivery scope',
    });
    expect(createProjectSchema.parse({ clientId: mixedCaseId, name: 'Valid name' })).toEqual({
      clientId: normalizedId,
      name: 'Valid name',
    });
    expect(
      createProjectSchema.parse({
        clientId: mixedCaseId,
        name: 'Valid name',
        description: '   ',
      }).description,
    ).toBeUndefined();
  });

  it.each(['unknown', 'tenantId', 'status', 'budget', 'progress', 'milestones'])(
    'rejects unsupported create property %s',
    (property) => {
      expect(() =>
        createProjectSchema.parse({
          clientId: mixedCaseId,
          name: 'Valid name',
          [property]: 'not-accepted',
        }),
      ).toThrow();
    },
  );

  it('parses supported updates and applies create normalization', () => {
    expect(
      updateProjectSchema.parse({
        clientId: mixedCaseId,
        name: '  Updated project  ',
        description: '  Updated scope  ',
        status: 'on_hold',
      }),
    ).toEqual({
      clientId: normalizedId,
      name: 'Updated project',
      description: 'Updated scope',
      status: 'on_hold',
    });
    expect(updateProjectSchema.parse({ description: null })).toEqual({ description: null });
  });

  it.each(['active', 'on_hold', 'completed', 'archived'])('accepts update status %s', (status) => {
    expect(updateProjectSchema.parse({ status })).toEqual({ status });
  });

  it('rejects empty, unknown-status, tenant, and timestamp updates', () => {
    expect(() => updateProjectSchema.parse({})).toThrow();
    expect(() => updateProjectSchema.parse({ status: 'deleted' })).toThrow();
    expect(() => updateProjectSchema.parse({ tenantId: mixedCaseId })).toThrow();
    expect(() => updateProjectSchema.parse({ createdAt: '2026-01-01' })).toThrow();
    expect(() => updateProjectSchema.parse({ updatedAt: '2026-01-01' })).toThrow();
  });

  it('normalizes valid Project params and rejects invalid IDs safely', () => {
    expect(projectIdParamsSchema.parse({ projectId: mixedCaseId })).toEqual({
      projectId: normalizedId,
    });
    const submitted = 'private-invalid-project-id';
    const parsed = projectIdParamsSchema.safeParse({ projectId: submitted });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error.issues)).not.toContain(submitted);
  });

  it('defaults and coerces list pagination and parses filters', () => {
    expect(listProjectsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      listProjectsQuerySchema.parse({
        page: '2',
        limit: '50',
        status: 'archived',
        clientId: mixedCaseId,
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      status: 'archived',
      clientId: normalizedId,
    });
  });

  it('rejects oversized limits, unknown query fields, and unsafe values', () => {
    expect(() => listProjectsQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => listProjectsQuerySchema.parse({ search: 'private-search-value' })).toThrow();
    const submitted = 'private-client-id';
    const parsed = listProjectsQuerySchema.safeParse({ clientId: submitted });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error.issues)).not.toContain(submitted);
  });
});
