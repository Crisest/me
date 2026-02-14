import { Request, Response } from 'express';
import * as fixedExpenseService from './fixedExpense.service';
import {
  CreateFixedExpensePayload,
  UpdateFixedExpensePayload,
} from '@portfolio/common';

export const getFixedExpensesByUserId = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const expenses =
      await fixedExpenseService.getAllFixedExpensesByUserId(userId);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixed expenses' });
  }
};

export const getFixedExpenseById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const expense = await fixedExpenseService.getFixedExpenseById(id, userId);

    if (!expense) {
      return res.status(404).json({ error: 'Fixed expense not found' });
    }

    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixed expense' });
  }
};

export const postFixedExpense = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const payload = req.body as CreateFixedExpensePayload;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const expense = await fixedExpenseService.createFixedExpense(
      payload,
      userId
    );
    res.status(201).json(expense);
  } catch (err) {
    res
      .status(400)
      .json({ error: 'Failed to create fixed expense', details: err });
  }
};

export const putFixedExpense = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const payload = req.body as UpdateFixedExpensePayload;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const expense = await fixedExpenseService.updateFixedExpense(
      id,
      payload,
      userId
    );

    if (!expense) {
      return res.status(404).json({ error: 'Fixed expense not found' });
    }

    res.json(expense);
  } catch (err) {
    res
      .status(400)
      .json({ error: 'Failed to update fixed expense', details: err });
  }
};

export const deleteFixedExpense = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deleted = await fixedExpenseService.deleteFixedExpense(id, userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Fixed expense not found' });
    }

    res.status(204).send();
  } catch (err) {
    res
      .status(400)
      .json({ error: 'Failed to delete fixed expense', details: err });
  }
};
