import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('email must be valid'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'password is required'),
});

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(72, 'password must be at most 72 characters'),
  name: z.string().trim().min(1).max(100).optional(),
});
