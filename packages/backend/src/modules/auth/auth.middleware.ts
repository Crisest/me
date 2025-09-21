import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@/modules/users/user.model';
import { getConfig } from '@/config/env';

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

  try {
    const config = getConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
    };

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;

    next();
  } catch (error) {
    // Clear the invalid cookie
    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
    });
    return res.status(401).json({ message: 'Invalid authentication token' });
  }
};
