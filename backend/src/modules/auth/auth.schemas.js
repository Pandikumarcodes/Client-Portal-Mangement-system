import { z } from 'zod';

const PASSWORD_MESSAGE = 'Password must contain lowercase, uppercase, and numeric characters.';
const PASSWORD_SCHEMA = z
  .string()
  .min(8, 'Password must contain at least 8 characters.')
  .max(128, 'Password must contain at most 128 characters.')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: PASSWORD_MESSAGE,
  });

const emailSchema = z.string().trim().toLowerCase().email('Email format is invalid.').max(254);

export const registerSchema = z
  .object({
    organizationName: z.string().trim().min(2).max(120),
    organizationSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: emailSchema,
    password: PASSWORD_SCHEMA,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password must be a non-empty string.').max(128),
  })
  .strict();
