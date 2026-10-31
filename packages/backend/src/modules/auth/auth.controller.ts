// modules/auth/auth.controller.ts
import { NextFunction, Request, Response } from 'express';
import * as AuthService from './auth.service';
import {
  LoginPayload,
  LoginResponse,
  MeResponse,
  RegisterPayload,
  RegisterResponse,
} from '@portfolio/common';
import { getConfig } from '@/config/env';
import { clearAuthCookie, setAuthCookie } from './auth.cookie';
import { RequestWithUser } from '@/types/express';
import { toUser } from '../users/user.mapper';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  const log = req.log.child({ action: 'register' });
  try {
    const payload: RegisterPayload = req.body;
    const { email, password, name } = payload;
    log.info({ email, name }, 'Starting user registration');

    const user = await AuthService.register(email, password, name);

    setAuthCookie(res, AuthService.issueToken(user));

    log.info({ userId: user.id }, 'User registration successful');
    const body: RegisterResponse = { message: 'User created', user: toUser(user) };
    res.status(201).json(body);
  } catch (err) {
    log.warn({ err }, 'User registration failed');
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const log = req.log.child({ action: 'login' });
  try {
    const payload: LoginPayload = req.body;
    const { email } = payload;
    log.info({ email }, 'User login attempt');

    const { user, token } = await AuthService.login(email, payload.password);
    setAuthCookie(res, token);

    log.info({ userId: user.id }, 'User login successful');
    const body: LoginResponse = { user: toUser(user) };
    res.status(200).json(body);
  } catch (err) {
    log.warn({ err }, 'User login failed');
    next(err);
  }
};

export const logout = async (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
};

export const me = async (req: Request, res: Response) => {
  try {
    // The user should be attached to req by the auth middleware
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const body: MeResponse = {
      ...req.user,
      config: { appUrl: getConfig().frontendUrl },
    };

    res.status(200).json(body);
  } catch (err: any) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
