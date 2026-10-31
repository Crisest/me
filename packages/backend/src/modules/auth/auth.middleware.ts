import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '@/modules/users/user.service';
import { getConfig } from '@/config/env';
import { clearAuthCookie } from './auth.cookie';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ message: 'No authentication token found' });
  }

  if (req.user) {
    next();
    return;
  }

  let userId: string;
  try {
    ({ userId } = jwt.verify(token, getConfig().jwtSecret) as {
      userId: string;
    });
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ message: 'Invalid authentication token' });
  }

  let user;
  try {
    user = await findUserById(userId);
  } catch (err) {
    return next(err); // DB failure → errorHandler 500, session kept
  }

  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({ message: 'User not found' });
  }

  req.user = { id: user.id, email: user.email, name: user.name || '' };
  next();
};
