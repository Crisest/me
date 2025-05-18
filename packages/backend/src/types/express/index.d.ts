// types/express/index.d.ts
import { Logger } from 'bunyan';
import { IUser } from '@/modules/users/user.model';

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      startTime?: number;
      user?: IUser;
    }
  }
}

export interface RequestWithUser extends Request {
  user: IUser; // Note: This is non-optional in RequestWithUser
}
