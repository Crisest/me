import { Request, Response, NextFunction } from 'express';
import * as householdService from './household.service';

export const postHousehold = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body as { name: string };
    const household = await householdService.createHousehold(name, req.user!.id);
    req.log.info({ householdId: household.id }, 'household created');
    res.status(201).json({ household });
  } catch (err) {
    next(err);
  }
};

export const getHouseholds = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const household = await householdService.getHouseholdForUser(req.user!.id);
    res.json({ households: household ? [household] : [] });
  } catch (err) {
    next(err);
  }
};

export const postJoin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.body as { code: string };
    const household = await householdService.joinByCode(code, req.user!.id);
    res.json({ household });
  } catch (err) {
    next(err);
  }
};

export const patchHousehold = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body as { name: string };
    const household = await householdService.renameHousehold(req.params.id, name);
    res.json({ household });
  } catch (err) {
    next(err);
  }
};

export const postLeave = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const household = await householdService.leaveHousehold(
      req.params.id,
      req.user!.id
    );
    res.json({ household });
  } catch (err) {
    next(err);
  }
};

export const postInviteCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const household = await householdService.regenerateInviteCode(req.params.id);
    res.json({ household });
  } catch (err) {
    next(err);
  }
};

export const deleteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.body as { userId: string };
    // Self-removal redirects to leave, so the caller ends up in a fresh
    // solo household instead of with no household at all.
    const household =
      userId === req.user!.id
        ? await householdService.leaveHousehold(req.params.id, req.user!.id)
        : await householdService.removeMember(req.params.id, userId);
    res.json({ household });
  } catch (err) {
    next(err);
  }
};
