import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProjectFileStorage } from '../../../src/modules/project-files/project-file.storage.js';

let storageRoot;
let adapter;

const createTemporaryUpload = async (name = 'browser-name.bin', content = 'delivery') => {
  const temporaryRoot = path.join(storageRoot, '.tmp');
  await mkdir(temporaryRoot, { recursive: true });
  const temporaryPath = path.join(temporaryRoot, name);
  await writeFile(temporaryPath, content);
  return temporaryPath;
};

beforeEach(async () => {
  storageRoot = await mkdtemp(path.join(os.tmpdir(), 'project-file-storage-'));
  adapter = createProjectFileStorage({ storageRoot });
});

afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
});

describe('Project File storage', () => {
  it('rejects a filesystem root configuration', () => {
    expect(() =>
      createProjectFileStorage({ storageRoot: path.parse(path.resolve('.')).root }),
    ).toThrow(TypeError);
  });

  it('returns a frozen adapter and creates the root during persistence', async () => {
    const nestedRoot = path.join(storageRoot, 'nested');
    const nestedAdapter = createProjectFileStorage({ storageRoot: nestedRoot });
    await mkdir(path.join(nestedRoot, '.tmp'), { recursive: true });
    const source = path.join(nestedRoot, '.tmp', 'upload.tmp');
    await writeFile(source, 'pdf');

    expect(Object.isFrozen(nestedAdapter)).toBe(true);
    const result = await nestedAdapter.persistUploadedFile({
      temporaryPath: source,
      mimeType: 'application/pdf',
    });
    await expect(readFile(path.join(nestedRoot, result.storagePath), 'utf8')).resolves.toBe('pdf');
  });

  it('persists with a generated MIME-derived name and no root disclosure', async () => {
    const source = await createTemporaryUpload('../ignored-name');
    const result = await adapter.persistUploadedFile({
      temporaryPath: source,
      mimeType: 'image/jpeg',
    });

    expect(result.storedName).toMatch(/^[a-f0-9]{48}\.jpg$/);
    expect(result.storagePath).toBe(result.storedName);
    expect(result.sizeBytes).toBe(8);
    expect(JSON.stringify(result)).not.toContain(storageRoot);
    await expect(readFile(path.join(storageRoot, result.storagePath), 'utf8')).resolves.toBe(
      'delivery',
    );
  });

  it('does not overwrite duplicate source names', async () => {
    const firstSource = await createTemporaryUpload('same.tmp', 'one');
    const first = await adapter.persistUploadedFile({
      temporaryPath: firstSource,
      mimeType: 'text/plain',
    });
    const secondSource = await createTemporaryUpload('same.tmp', 'two');
    const second = await adapter.persistUploadedFile({
      temporaryPath: secondSource,
      mimeType: 'text/plain',
    });
    expect(first.storedName).not.toBe(second.storedName);
    await expect(readFile(path.join(storageRoot, first.storagePath), 'utf8')).resolves.toBe('one');
    await expect(readFile(path.join(storageRoot, second.storagePath), 'utf8')).resolves.toBe('two');
  });

  it('opens streamable content without returning a path', async () => {
    const source = await createTemporaryUpload();
    const persisted = await adapter.persistUploadedFile({
      temporaryPath: source,
      mimeType: 'text/plain',
    });
    const stream = await adapter.openStoredFile({ storagePath: persisted.storagePath });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe('delivery');
  });

  it('preserves missing-file filesystem conditions', async () => {
    await expect(adapter.openStoredFile({ storagePath: 'missing.pdf' })).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it.each(['../outside.pdf', path.resolve(os.tmpdir(), 'outside.pdf')])(
    'rejects an escaping or absolute storage path',
    async (storagePath) => {
      await expect(adapter.openStoredFile({ storagePath })).rejects.toMatchObject({
        code: 'PROJECT_FILE_STORAGE_PATH_INVALID',
      });
    },
  );

  it('removes rollback content and tolerates an already missing file', async () => {
    const source = await createTemporaryUpload();
    const persisted = await adapter.persistUploadedFile({
      temporaryPath: source,
      mimeType: 'application/pdf',
    });
    await adapter.removeStoredFile({ storagePath: persisted.storagePath });
    await expect(adapter.removeStoredFile({ storagePath: persisted.storagePath })).resolves.toBe(
      undefined,
    );
  });

  it('never connects to MongoDB', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect');
    const source = await createTemporaryUpload();
    await adapter.persistUploadedFile({ temporaryPath: source, mimeType: 'text/csv' });
    expect(connectSpy).not.toHaveBeenCalled();
    connectSpy.mockRestore();
  });
});
