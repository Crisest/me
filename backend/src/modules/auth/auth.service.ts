// modules/auth/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../users/user.model';

const SALT_ROUNDS = 10;

export const register = async (
  email: string,
  password: string,
  name?: string
) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error('User already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = new User({ email, passwordHash, name });
  await user.save();
  return user;
};

export const login = async (email: string, password: string) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  return { user, token };
};
