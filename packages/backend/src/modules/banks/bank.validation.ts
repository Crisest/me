import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { banks } from '../../db/schema';

/**
 * Derived from the table, then narrowed to what the client may send.
 * createdBy comes from the authenticated session, never the request body.
 */
export const createBankSchema = createInsertSchema(banks, {
  name: z.string().trim().min(1, 'name is required'),
}).pick({ name: true });
