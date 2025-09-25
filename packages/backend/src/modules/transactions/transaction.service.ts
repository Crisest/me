import { ITransaction, Transaction } from './transaction.model';
import mongoose from 'mongoose';
import { normalizeDate } from '@portfolio/common/src/utils/date';
import {
  CreateTransactionsPayload,
  Transaction as CommonTransaction,
} from '@portfolio/common';

export const getAllTransactions = async (
  userId: mongoose.Types.ObjectId,
  month?: number
): Promise<ITransaction[]> => {
  const query: any = { createdBy: userId };

  if (month) {
    const year = new Date().getFullYear();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    query.date = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const result = await Transaction.find(query).sort({ date: -1 });

  return result;
};

export const createManyTransactionsByUser = async (
  payload: CreateTransactionsPayload,
  userId: mongoose.Types.ObjectId
) => {
  const { transactions, cardId, bankId } = payload;

  const transactionsToAdd = Transaction.fromCommonTransaction(
    transactions,
    userId,
    cardId,
    bankId,
    'TEMP' // Or pass a real groupId if needed
  );

  await Transaction.insertMany(transactionsToAdd);
};
