import Logger from 'bunyan';
// types/express/index.d.ts
import { UserRow } from '../../db/schema';
import { AuthUser } from '../auth';
import { BudgetScope } from '../../middleware/resolveBudgetScope';

declare global {
  namespace Express {
    interface Request {
      log: Logger;
      startTime?: number;
      user?: AuthUser;
      budgetScope?: BudgetScope;
    }
  }
}

export interface RequestWithUser extends Request {
  user: UserRow; // Note: This is non-optional in RequestWithUser
}
