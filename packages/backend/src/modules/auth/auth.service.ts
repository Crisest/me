import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { db } from '../../db/client';
import { users, type UserRow } from '../../db/schema';
import { findUserByEmail } from '../users/user.service';
import { createHousehold } from '../households/household.service';

const SALT_ROUNDS = 10;
// Compared against when the email is unknown so login takes the same time as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', SALT_ROUNDS);

export const register = async (
  email: string,
  password: string,
  name?: string
): Promise<UserRow> => {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser)
    throw new AppError('An account with this email already exists', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // One transaction: a user must never exist without a household, because
  // every budget read resolves through one.
  return db.transaction(async tx => {
    const [row] = await tx
      .insert(users)
      .values({ email: normalizedEmail, passwordHash, name })
      .returning();

    await createHousehold(`${name ?? normalizedEmail}'s Household`, row.id, tx);

    return row;
  });
};

// user.id is already a string; previously this was a BSON ObjectId that
// jsonwebtoken serialised to hex. The payload shape is unchanged.
export const issueToken = (user: Pick<UserRow, 'id' | 'email'>): string =>
  jwt.sign({ userId: user.id, email: user.email }, getConfig().jwtSecret, {
    expiresIn: '7d',
  });

export const login = async (email: string, password: string) => {
  const user = await findUserByEmail(email);
  const isMatch = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH
  );
  if (!user || !isMatch) throw new AppError('Invalid credentials', 401);
  return { user, token: issueToken(user) };
};
