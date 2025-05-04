// types/express/index.d.ts
import { Request, Response, NextFunction } from 'express';
import { IUser } from '@/modules/users/user.model';

export interface RequestWithUser extends Request {
  user: IUser;
}
