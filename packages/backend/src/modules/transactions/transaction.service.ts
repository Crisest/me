import Transaction, { ITransaction } from './transaction.model';
import mongoose from 'mongoose';

export const getAllTransactions = async (
  userId: mongoose.Types.ObjectId
): Promise<ITransaction[]> => {
  return Transaction.find({ user: userId }).sort({ date: -1 });
};

export const createTransaction = async (
  data: Partial<ITransaction>
): Promise<ITransaction> => {
  if (!data.user) {
    throw new Error('User is required to create a transaction');
  }

  const transaction = new Transaction(data);
  return transaction.save();
};

export const createManyTransactions = async (
  transactions: (Omit<ITransaction, '_id'> & {
    user: mongoose.Types.ObjectId;
  })[]
): Promise<ITransaction[]> => {
  return Transaction.insertMany(transactions);
};
