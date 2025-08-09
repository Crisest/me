import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@/modules/users/user.model';
import { getConfig } from '@/config/env';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('auth.middleware: START');
  const token = req.cookies.jwt;
  console.log('auth.middleware: token', token);

  if (!token) {
    console.log('auth.middleware: No token found');
    return res.status(401).json({ message: 'No authentication token found' });
  }

  if (req.user) {
    console.log('auth.middleware: req.user already set', req.user);
    next();
    return;
  }

  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
    };
    console.log('auth.middleware: decoded token', decoded);

    const user = await User.findById(decoded.userId);
    console.log('auth.middleware: user from DB', user);
    if (!user) {
      console.log('auth.middleware: User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    console.log('auth.middleware: req.user set', req.user);

    next();
  } catch (error) {
    console.log('auth.middleware: error', error);
    // Clear the invalid cookie
    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
    });
    return res.status(401).json({ message: 'Invalid authentication token' });
  }
};
