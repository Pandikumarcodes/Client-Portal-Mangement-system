import mongoose from 'mongoose';
import { afterAll, describe, expect, it, vi } from 'vitest';

const connectSpy = vi.spyOn(mongoose, 'connect');
const disconnectSpy = vi.spyOn(mongoose, 'disconnect');
const projectModule = await import('../../../src/modules/projects/project.model.js');
const { Project } = projectModule;

const validProject = {
  tenantId: new mongoose.Types.ObjectId(),
  clientId: new mongoose.Types.ObjectId(),
  name: 'Portal redesign',
  description: 'A focused delivery project',
};

const validationError = async (values) => {
  try {
    await new Project(values).validate();
  } catch (error) {
    return error;
  }
  throw new Error('Expected Project validation to fail.');
};

afterAll(() => {
  connectSpy.mockRestore();
  disconnectSpy.mockRestore();
});

describe('Project model', () => {
  it('exports only the default-connection Project Mongoose model without connecting', () => {
    expect(Object.keys(projectModule)).toEqual(['Project']);
    expect(Project.prototype).toBeInstanceOf(mongoose.Model);
    expect(Project.modelName).toBe('Project');
    expect(Project.collection.name).toBe('projects');
    expect(connectSpy).not.toHaveBeenCalled();
    expect(disconnectSpy).not.toHaveBeenCalled();
    expect(mongoose.connection.readyState).toBe(0);
  });

  it('validates a valid Project and applies the active default', async () => {
    const project = new Project(validProject);
    await expect(project.validate()).resolves.toBeUndefined();
    expect(project.status).toBe('active');
  });

  it('requires tenantId and clientId with string model references', async () => {
    expect(Project.schema.path('tenantId').options.ref).toBe('Organization');
    expect(Project.schema.path('clientId').options.ref).toBe('Client');
    expect(
      (await validationError({ ...validProject, tenantId: undefined })).errors.tenantId,
    ).toBeDefined();
    expect(
      (await validationError({ ...validProject, clientId: undefined })).errors.clientId,
    ).toBeDefined();
  });

  it('requires and trims a 2-150 character name without changing capitalization', async () => {
    const project = new Project({ ...validProject, name: '  Portal Redesign  ' });
    await project.validate();
    expect(project.name).toBe('Portal Redesign');
    expect((await validationError({ ...validProject, name: undefined })).errors.name).toBeDefined();
    expect(await validationError({ ...validProject, name: 'x' })).toBeTruthy();
    expect(await validationError({ ...validProject, name: 'x'.repeat(151) })).toBeTruthy();
  });

  it('keeps description optional, trims it, and rejects more than 2000 characters', async () => {
    const project = new Project({ ...validProject, description: '  Delivery scope  ' });
    await project.validate();
    expect(project.description).toBe('Delivery scope');
    const optional = new Project({ ...validProject, description: '   ' });
    await expect(optional.validate()).resolves.toBeUndefined();
    expect(optional.description).toBeUndefined();
    expect(await validationError({ ...validProject, description: 'x'.repeat(2001) })).toBeTruthy();
  });

  it.each(['active', 'on_hold', 'completed', 'archived'])(
    'accepts supported status %s',
    async (status) => {
      await expect(new Project({ ...validProject, status }).validate()).resolves.toBeUndefined();
    },
  );

  it('rejects an unknown status', async () => {
    expect(
      (await validationError({ ...validProject, status: 'deleted' })).errors.status,
    ).toBeDefined();
  });

  it('uses timestamps, no version key, and strict throw', () => {
    expect(Project.schema.options.timestamps).toBe(true);
    expect(Project.schema.options.versionKey).toBe(false);
    expect(Project.schema.options.strict).toBe('throw');
    expect(Project.schema.path('createdAt')).toBeDefined();
    expect(Project.schema.path('updatedAt')).toBeDefined();
  });

  it('rejects unknown fields without connecting or exposing their values', async () => {
    const error = await validationError({ ...validProject, extra: 'private-fixture-value' });
    expect(error.name).toBe('StrictModeError');
    expect(error.message).not.toContain('private-fixture-value');
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('contains no deferred business fields', () => {
    for (const field of [
      'startDate',
      'dueDate',
      'budget',
      'currency',
      'progress',
      'milestoneIds',
      'milestones',
      'fileIds',
      'invoiceIds',
      'assignedTeamMembers',
      'notes',
      'activityEntries',
      'deletedAt',
    ]) {
      expect(Project.schema.path(field)).toBeUndefined();
    }
  });

  it('defines exactly the two requested listing indexes', () => {
    expect(Project.schema.indexes()).toEqual([
      [{ tenantId: 1, createdAt: -1 }, { name: 'idx_projects_tenant_created_at' }],
      [
        { tenantId: 1, clientId: 1, createdAt: -1 },
        { name: 'idx_projects_tenant_client_created_at' },
      ],
    ]);
  });
});
