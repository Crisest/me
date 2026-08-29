import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/env';
import { db } from '../../db/client';
import { users, type UserRow } from '../../db/schema';
import { findUserByEmail } from '../users/user.service';

const SALT_ROUNDS = 10;

export const register = async (
  email: string,
  password: string,
  name?: string
): Promise<UserRow> => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) throw new Error('User already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning();
  return row;
};

export const login = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error('Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new Error('Invalid credentials');

  const config = getConfig();
  // user.id is already a string; previously this was a BSON ObjectId that
  // jsonwebtoken serialised to hex. The payload shape is unchanged.
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return { user, token };
};
