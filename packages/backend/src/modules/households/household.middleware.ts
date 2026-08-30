import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { households } from '../../db/schema';
import { AppError } from '../../middleware/errorHandler';
import { listActiveMembers } from './household.service';

/**
 * Verifies the authenticated user has an active membership in :id.
 * On success `{ id, members }` is left on res.locals.household so the
 * handler does not need to re-query it. Mirrors `requireGroupMembership`
 * in src/modules/groups/group.middleware.ts.
 */
export const requireHouseholdMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const [household] = await db
      .select({ id: households.id, archived: households.archived })
      .from(households)
      .where(eq(households.id, id))
      .limit(1);

    if (!household || household.archived) {
      return next(new AppError('Household not found', 404));
    }

    const members = await listActiveMembers(household.id);
    const memberIds = members.map(m => m.id);

    if (!memberIds.includes(req.user!.id)) {
      return next(new AppError('Not a member of this household', 403));
    }

    res.locals.household = { id: household.id, members };
    next();
  } catch (err) {
    next(err);
  }
};
