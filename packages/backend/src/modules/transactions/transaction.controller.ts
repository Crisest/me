import { Request, Response } from 'express';
import * as transactionService from './transaction.service';
import { CreateTransactionsPayload } from '@portfolio/common';
import mongoose from 'mongoose';

export const getTransactionsByUserId = async (req: Request, res: Response) => {
  try {
    const month = Number(req.query.month);
    const userId = req.user!._id;
    console.log('userId:', userId, typeof userId);
    const transactions = await transactionService.getAllTransactions(
      req.user!.id,
      month
    );

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const postTransactionByUser = async (req: Request, res: Response) => {
  try {
    // const created = await transactionService.createTransaction({
    //   ...req.body,
    //   user: req.user._id,
    // });
    res.status(201).json();
  } catch (err) {
    res
      .status(400)
      .json({ error: 'Failed to create transaction', details: err });
  }
};

export const postManyTransactionsByUser = async (
  req: Request,
  res: Response
) => {
  try {
    const payload = req.body as CreateTransactionsPayload;
    const userId = req.user!._id as mongoose.Types.ObjectId;

    const created = await transactionService.createManyTransactionsByUser(
      payload,
      userId
    );

    res.status(201).json(created);
  } catch (err) {
    console.log({ error: err });
    res.status(400).json({
      error: 'Failed to create transactions in bulk',
      details: err,
    });
  }
};
