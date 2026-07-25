import { z } from 'zod';

import { PROJECT_STATUS } from './project.constants.js';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'ID is invalid.')
  .transform((value) => value.toLowerCase());
const name = z.string().trim().min(2).max(150);
const description = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => value || undefined);

export const createProjectSchema = z
  .object({
    clientId: objectId,
    name,
    description: description.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    clientId: objectId.optional(),
    name: name.optional(),
    description: description.nullable().optional(),
    status: z.enum(Object.values(PROJECT_STATUS)).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one project field is required.',
  });

export const projectIdParamsSchema = z
  .object({
    projectId: objectId,
  })
  .strict();

export const listProjectsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(Object.values(PROJECT_STATUS)).optional(),
    clientId: objectId.optional(),
  })
  .strict();
