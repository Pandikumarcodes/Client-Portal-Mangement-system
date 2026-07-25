import { z } from 'zod';
import { CLIENT_STATUS } from './client.constants.js';

const email = z.string().trim().toLowerCase().email('Email format is invalid.').max(254);
const company = z
  .string()
  .trim()
  .max(120)
  .transform((value) => value || undefined);
const firstName = z.string().trim().min(1).max(80);
const lastName = z.string().trim().min(1).max(80);

export const createClientSchema = z
  .object({ firstName, lastName, email, companyName: company.optional() })
  .strict();
export const updateClientSchema = z
  .object({
    firstName: firstName.optional(),
    lastName: lastName.optional(),
    email: email.optional(),
    companyName: company.nullable().optional(),
    status: z.enum(Object.values(CLIENT_STATUS)).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one client field is required.',
  });
export const clientIdParamsSchema = z
  .object({
    clientId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'Client ID is invalid.')
      .transform((value) => value.toLowerCase()),
  })
  .strict();
export const listClientsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(Object.values(CLIENT_STATUS)).optional(),
  })
  .strict();
