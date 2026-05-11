import { Request, Response, NextFunction } from 'express';
import * as budgetService from './budget.service';
import { BudgetPayloads, BudgetOverridePayloads } from '@portfolio/common';

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

export const getOverride = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const override = await budgetService.getBudgetOverride(req.user!.id, month, year);
    res.json({ override });
  } catch (err) {
    next(err);
  }
};

export const putOverride = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as BudgetOverridePayloads.Upsert;
    const override = await budgetService.upsertBudgetOverride(req.user!.id, payload);
    res.json({ override });
  } catch (err) {
    next(err);
  }
};
