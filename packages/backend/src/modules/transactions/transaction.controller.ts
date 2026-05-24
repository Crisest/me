import { NextFunction, Request, Response } from 'express';
import * as transactionService from './transaction.service';
import { TransactionPayloads } from '@portfolio/common';

export const getTransactionsByUserId = async (req: Request, res: Response) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    const options = {
      month: isNaN(month) ? undefined : month,
      year: isNaN(year) ? undefined : year,
    };

    const transactions = await transactionService.getAllTransactions(
      req.user!.id,
      options
    );

    res.json(transactions);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch transactions');
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const postManyTransactionsByUser = async (
  req: Request,
  res: Response
) => {
  try {
    const payload = req.body as TransactionPayloads.CreateMany;
    const userId = req.user!.id;

    await transactionService.createManyTransactionsByUser(payload, userId);

    res.status(201).json();
  } catch (err) {
    req.log.error({ err }, 'Failed to create transactions in bulk');
    res.status(400).json({ error: 'Failed to create transactions in bulk' });
  }
};

export const matchFixedExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const fixedExpenseId: string | null = req.body.fixedExpenseId ?? null;

    const updated = await transactionService.setTransactionFixedExpense(
      userId,
      id,
      fixedExpenseId
    );

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, 'Failed to match fixed expense');
    next(err);
  }
};
