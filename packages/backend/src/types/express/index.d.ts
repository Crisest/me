import Logger from 'bunyan';
// types/express/index.d.ts
import { IUser } from '../../modules/users/user.model';
import { AuthUser } from '../auth';

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      startTime?: number;
      user?: AuthUser;
    }
  }
}

export interface RequestWithUser extends Request {
  user: IUser; // Note: This is non-optional in RequestWithUser
}
