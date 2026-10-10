import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { accounts } from '../../db/schema';

export const createAccountSchema = createInsertSchema(accounts, {
  name: z.string().trim().min(1, 'name is required'),
  bankId: z.string().uuid('bankId must be a valid id'),
}).pick({ name: true, bankId: true });
