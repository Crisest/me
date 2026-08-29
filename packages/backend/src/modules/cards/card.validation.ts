import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { cards } from '../../db/schema';

export const createCardSchema = createInsertSchema(cards, {
  name: z.string().trim().min(1, 'name is required'),
  bankId: z.string().uuid('bankId must be a valid id'),
}).pick({ name: true, bankId: true });
