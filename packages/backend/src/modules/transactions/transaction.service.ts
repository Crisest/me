import { ITransaction, Transaction } from './transaction.model';
import mongoose from 'mongoose';
import { normalizeDate } from '@portfolio/common/src/utils/date';
import { CreateTransactionsPayload } from '@portfolio/common';

export const getAllTransactions = async (
  userId: mongoose.Types.ObjectId
): Promise<ITransaction[]> => {
  return Transaction.find({ createdBy: userId }).sort({ date: -1 });
};

export const createTransaction = async (
  data: Partial<ITransaction>
): Promise<ITransaction> => {
  if (!data.createdBy) {
    throw new Error('User is required to create a transaction');
  }
  if (data.date) {
    data.date = normalizeDate(data.date);
  }
  const transaction = new Transaction(data);
  return transaction.save();
};

export const createManyTransactionsByUser = async (
  transactions: CreateTransactionsPayload,
  userId: mongoose.Types.ObjectId
): Promise<ITransaction[]> => {
  const transactionsToAdd = Transaction.fromCommonTransaction(
    transactions,
    userId
  );
  return await Transaction.insertMany(transactionsToAdd);
};
