import { Request, Response, NextFunction } from 'express';
import * as budgetService from './budget.service';
import { BudgetPayloads } from '@portfolio/common';

export const getBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const budget = await budgetService.getBudgetByUserId(req.user!.id);
    res.json({ budget });
  } catch (err) {
    next(err);
  }
};

export const putBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as BudgetPayloads.Upsert;
    const budget = await budgetService.upsertBudget(req.user!.id, payload);
    res.json({ budget });
  } catch (err) {
    next(err);
  }
};
