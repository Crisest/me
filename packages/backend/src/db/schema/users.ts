import { pgTable, text } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';

export const users = pgTable('users', {
  id: primaryId(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  ...timestamps,
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
