import { z } from 'zod';

import { PROJECT_FILE_STATUS } from './project-file.constants.js';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'ID is invalid.')
  .transform((value) => value.toLowerCase());
const description = z
  .string()
  .trim()
  .max(500, 'Description must contain at most 500 characters.')
  .transform((value) => value || undefined);

export const uploadProjectFileFieldsSchema = z
  .object({
    description: description.optional(),
  })
  .strict();

export const updateProjectFileSchema = z
  .object({
    description: description.nullable().optional(),
    status: z
      .enum(Object.values(PROJECT_FILE_STATUS), {
        message: 'Project File status is invalid.',
      })
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one Project File field is required.',
  });

export const projectFilesParamsSchema = z.object({ projectId: objectId }).strict();

export const projectFileParamsSchema = z
  .object({
    projectId: objectId,
    fileId: objectId,
  })
  .strict();

export const listProjectFilesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(Object.values(PROJECT_FILE_STATUS)).optional(),
  })
  .strict();
