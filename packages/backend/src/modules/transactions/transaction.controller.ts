import { Response } from 'express';
import { RequestWithUser } from '@/types/express';
import * as transactionService from './transaction.service';
import { ITransaction } from './transaction.model';

export const getTransactionsByUserId = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const transactions = await transactionService.getAllTransactions(
      req.user.id
    );
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const postTransactionByUser = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const created = await transactionService.createTransaction({
      ...req.body,
      user: req.user._id,
    });
    res.status(201).json(created);
  } catch (err) {
    res
      .status(400)
      .json({ error: 'Failed to create transaction', details: err });
  }
};

export const postManyTransactionsByUser = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user._id;

    const transactionsWithUser = req.body.map((trx: Partial<ITransaction>) => ({
      ...trx,
      user: userId,
    }));

    const created =
      await transactionService.createManyTransactions(transactionsWithUser);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({
      error: 'Failed to create transactions in bulk',
      details: err,
    });
  }
};
