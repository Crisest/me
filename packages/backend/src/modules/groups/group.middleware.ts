import { Request, Response, NextFunction } from 'express';
import { Group } from './group.model';
import { AppError } from '../../middleware/errorHandler';

/**
 * Verifies the authenticated user is a member of :groupId.
 * On success the loaded group is left on res.locals.group so the
 * handler does not need to re-query it.
 */
export const requireGroupMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) {
      return next(new AppError('Group not found', 404));
    }

    const isMember = group.members.some(
      memberId => memberId.toString() === req.user!.id
    );

    if (!isMember) {
      return next(new AppError('Not a member of this group', 403));
    }

    res.locals.group = group;
    next();
  } catch (err) {
    next(err);
  }
};
