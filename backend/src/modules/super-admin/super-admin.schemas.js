import { z } from 'zod';

import { ORGANIZATION_STATUS } from '../organizations/organization.constants.js';
import { USER_ROLE, USER_STATUS } from '../users/user.constants.js';

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const organizationParamsSchema = z
  .object({
    organizationId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'Organization ID is invalid.')
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export const listOrganizationsQuerySchema = z
  .object({
    ...paginationFields,
    status: z.enum(Object.values(ORGANIZATION_STATUS)).optional(),
  })
  .strict();

export const updateOrganizationStatusSchema = z
  .object({
    status: z.enum(Object.values(ORGANIZATION_STATUS)),
  })
  .strict();

export const listOrganizationUsersQuerySchema = z
  .object({
    ...paginationFields,
    role: z.enum([USER_ROLE.ORGANIZATION_ADMIN, USER_ROLE.CLIENT]).optional(),
    status: z.enum(Object.values(USER_STATUS)).optional(),
  })
  .strict();
