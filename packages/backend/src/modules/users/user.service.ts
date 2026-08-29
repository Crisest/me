import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { groupMembers, users, type UserRow } from '../../db/schema';

export const findUserById = async (
  id: string
): Promise<UserRow | undefined> => {
  return db.query.users.findFirst({ where: eq(users.id, id) });
};

export const findUserByEmail = async (
  email: string
): Promise<UserRow | undefined> => {
  return db.query.users.findFirst({ where: eq(users.email, email) });
};

/**
 * Replaces the denormalised User.groups[] array. The join table is now the
 * single source of truth for membership.
 */
export const getGroupIdsForUser = async (
  userId: string
): Promise<string[]> => {
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  return rows.map(r => r.groupId);
};
