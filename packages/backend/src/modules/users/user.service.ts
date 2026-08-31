import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users, type UserRow } from '../../db/schema';

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
