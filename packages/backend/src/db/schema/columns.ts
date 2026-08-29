import { timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

/**
 * Every table's primary key.
 *
 * uuid v7 is time-ordered, so sequential inserts land in adjacent index pages
 * (uuid v4 scatters them, which fragments the B-tree). Generated in TypeScript
 * rather than by Postgres so the id is known before the INSERT round-trip and
 * so no Postgres version floor is introduced.
 */
export const primaryId = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

/**
 * Spread into every table definition: `...timestamps`.
 *
 * `$onUpdate` runs in TypeScript on every drizzle UPDATE. It does NOT fire for
 * raw SQL updates that bypass drizzle — acceptable here because all writes go
 * through drizzle.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
