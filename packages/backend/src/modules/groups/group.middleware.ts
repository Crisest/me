import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { groupMembers, groups } from '../../db/schema';
import { AppError } from '../../middleware/errorHandler';

/**
 * Verifies the authenticated user is a member of :groupId.
 * On success `{ id, members }` is left on res.locals.group so the
 * handler does not need to re-query it.
 */
export const requireGroupMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { groupId } = req.params;
    const [group] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (!group) {
      return next(new AppError('Group not found', 404));
    }

    const memberRows = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
    const memberIds = memberRows.map(r => r.userId);

    if (!memberIds.includes(req.user!.id)) {
      return next(new AppError('Not a member of this group', 403));
    }

    res.locals.group = { id: group.id, members: memberIds };
    next();
  } catch (err) {
    next(err);
  }
};
