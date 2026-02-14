import { Request, Response } from 'express';
import * as budgetService from './budget.service';
import { UpdateBudgetPayload } from '@portfolio/common';

export const getBudget = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const budget = await budgetService.getOrCreateBudget(userId);
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
};

export const putBudget = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const payload = req.body as UpdateBudgetPayload;

    const budget = await budgetService.updateBudgetByUserId(userId, payload);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update budget', details: err });
  }
};
