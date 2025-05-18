// modules/auth/auth.controller.ts
import { Request, Response } from 'express';
import * as AuthService from './auth.service';
import { LoginPayload, RegisterPayload } from '@portfolio/common';
import { getConfig } from '@/config/env';
import { RequestWithUser } from '@/types/express';

export const register = async (req: Request, res: Response) => {
  const log = req.log.child({ action: 'register' });
  try {
    const payload: RegisterPayload = req.body;
    const { email, password, name } = payload;
    log.info({ email, name }, 'Starting user registration');

    const user = await AuthService.register(email, password, name);

    log.info({ userId: user._id }, 'User registration successful');
    res.status(201).json({ message: 'User created', user: user.toUser() });
  } catch (err: any) {
    log.error({ err }, 'User registration failed');
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const log = req.log.child({ action: 'login' });
  try {
    const payload: LoginPayload = req.body;
    const { email } = payload;
    log.info({ email }, 'User login attempt');

    const { user, token } = await AuthService.login(email, payload.password);
    const config = getConfig();

    // Set JWT as HttpOnly cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production', // Only send cookie over HTTPS in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/',
    });

    log.info({ userId: user._id }, 'User login successful');
    res.status(200).json({ user: user.toUser() });
  } catch (err: any) {
    log.error({ err, email: req.body.email }, 'User login failed');
    res.status(401).json({ message: err.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

export const me = async (req: RequestWithUser, res: Response) => {
  try {
    // The user should be attached to req by the auth middleware
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    res.status(200).json({ user: req.user.toUser() });
  } catch (err: any) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
