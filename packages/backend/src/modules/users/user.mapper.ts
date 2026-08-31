import type { User } from '@portfolio/common';
import type { UserRow } from '../../db/schema';

/**
 * Deliberately omits `passwordHash`. Callers that serialise this straight into
 * an HTTP response (register/login) must not ship the bcrypt hash to the
 * client.
 */
export const toUser = (row: UserRow): Omit<User, 'passwordHash'> => ({
  id: row.id,
  email: row.email,
  name: row.name ?? undefined,
  createdAt: row.createdAt.toISOString(),
});
