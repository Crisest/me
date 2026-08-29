import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { budgetCategories } from '../../db/schema';

export const createCategorySchema = createInsertSchema(budgetCategories, {
  name: z.string().trim().min(1, 'name is required'),
  kind: z.enum(['fixed', 'flexible', 'ignored']),
  plannedAmount: z.number().optional(),
  color: z.string().optional(),
}).pick({ name: true, kind: true, plannedAmount: true, color: true });

export const updateCategorySchema = createCategorySchema.partial();
