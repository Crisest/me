import { NextFunction, Request, Response } from 'express';
import * as transactionService from './transaction.service';
import { TransactionPayloads } from '@portfolio/common';

export const getTransactionsByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const query = req.query as {
      month?: number;
      year?: number;
      categoryId?: string;
      scope?: 'mine' | 'household';
    };

    const transactions = await transactionService.getAllTransactions(
      req.user!.id,
      query,
      req.budgetScope!
    );

    res.json(transactions);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch transactions');
    next(err);
  }
};

export const postManyTransactionsByUser = async (
  req: Request,
  res: Response
) => {
  try {
    const payload = req.body as TransactionPayloads.CreateMany;
    const userId = req.user!.id;

    await transactionService.createManyTransactionsByUser(userId, payload);

    res.status(201).json();
  } catch (err) {
    req.log.error({ err }, 'Failed to create transactions in bulk');
    res.status(400).json({ error: 'Failed to create transactions in bulk' });
  }
};

export const setCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId: string | null = req.body.categoryId ?? null;
    const transaction = await transactionService.setTransactionCategory(
      req.budgetScope!,
      req.user!.id,
      req.params.id,
      { categoryId }
    );
    req.log.info(
      { transactionId: req.params.id, categoryId },
      'transaction category set'
    );
    res.json(transaction);
  } catch (err) {
    next(err);
  }
};
