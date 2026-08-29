import type { User } from '@portfolio/common';
import type { UserRow } from '../../db/schema';

/**
 * `groups` used to be an array column on the user document. It is now derived
 * from the group_members join table, so callers must supply it.
 *
 * Deliberately omits `passwordHash` — the Mongoose method this replaces
 * (`userSchema.methods.toUser`) never returned it either. Callers that
 * serialise this straight into an HTTP response (register/login) must not
 * ship the bcrypt hash to the client.
 */
export const toUser = (
  row: UserRow,
  groupIds: string[]
): Omit<User, 'passwordHash'> => ({
  id: row.id,
  email: row.email,
  name: row.name ?? undefined,
  createdAt: row.createdAt.toISOString(),
  groups: groupIds,
});
