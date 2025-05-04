// modules/auth/auth.controller.ts
import { Request, Response } from 'express';
import * as AuthService from './auth.service';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const user = await AuthService.register(email, password, name);
    res.status(201).json({ message: 'User created', user });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await AuthService.login(email, password);
    res.status(200).json({ user, token });
  } catch (err: any) {
    res.status(401).json({ message: err.message });
  }
};
