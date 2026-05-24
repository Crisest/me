import mongoose from 'mongoose';
import { TransactionModel } from './transaction.model';
import { Transaction, TransactionPayloads } from '@portfolio/common';
import { createUploadRecord } from '../uploads/upload.service';
import { BudgetModel, FixedExpenseSubdoc } from '../budget/budget.model';
import { AppError } from '../../middleware/errorHandler';

export const getAllTransactions = async (
  userId: string,
  options: { month?: number; year?: number }
): Promise<Transaction[]> => {
  const query: Record<string, any> = { createdBy: userId };
  const { month, year } = options;
  if (month) {
    const yearSelected = year || new Date().getFullYear();
    const startDate = new Date(yearSelected, month - 1, 1);
    const endDate = new Date(yearSelected, month, 1);
    query.date = { $gte: startDate, $lt: endDate };
  }

  const result = await TransactionModel.find(query)
    .populate({
      path: 'cardId',
      select: 'name bankId',
      populate: { path: 'bankId', select: 'name' },
    })
    .populate({
      path: 'accountId',
      select: 'name mask bankId',
      populate: { path: 'bankId', select: 'name' },
    })
    .sort({ date: -1 });

  return result.map(t => {
    const tx = t.toTransaction();

    const card = t.cardId as any;
    if (card && typeof card === 'object' && card.name) {
      tx.cardName = card.name;
      if (card.bankId && typeof card.bankId === 'object') {
        tx.bankName = card.bankId.name;
      }
    }

    const account = t.accountId as any;
    if (account && typeof account === 'object' && account.name) {
      tx.accountName = account.name;
      tx.accountMask = account.mask;
      if (account.bankId && typeof account.bankId === 'object') {
        tx.bankName = account.bankId.name;
      }
    }

    return tx;
  });
};

export const createManyTransactionsByUser = async (
  payload: TransactionPayloads.CreateMany,
  userId: string
) => {
  const { transactions, cardId, fileName, fileHash } = payload;

  const transactionsToAdd = TransactionModel.fromCreateManyPayload(
    transactions,
    userId,
    cardId,
    'TEMP'
  );

  await TransactionModel.insertMany(transactionsToAdd);
  await createUploadRecord(
    fileName,
    fileHash,
    cardId,
    transactions.length,
    userId
  );
};

/**
 * Match (or unmatch) a transaction to a fixed expense.
 * - Ownership: the transaction must belong to userId.
 * - If fixedExpenseId is non-null: it must exist on the user's Budget, and no
 *   other transaction by the same user in the same calendar month as
 *   transaction.date may already be matched to it.
 */
export const setTransactionFixedExpense = async (
  userId: string,
  transactionId: string,
  fixedExpenseId: string | null
): Promise<Transaction> => {
  const txn = await TransactionModel.findOne({
    _id: transactionId,
    createdBy: userId,
  });
  if (!txn) throw new AppError('Transaction not found', 404);

  if (fixedExpenseId === null) {
    txn.fixedExpenseId = undefined;
    await txn.save();
    return txn.toTransaction();
  }

  if (txn.amount <= 0) {
    throw new AppError(
      'Only debit transactions can be matched to a fixed expense',
      400
    );
  }

  const budget = await BudgetModel.findOne({ createdBy: userId });
  const exists = budget?.fixedExpenses.some(
    (e: FixedExpenseSubdoc) => e._id.toString() === fixedExpenseId
  );
  if (!exists) {
    throw new AppError('Fixed expense not found on your budget', 400);
  }

  const monthStart = new Date(txn.date.getFullYear(), txn.date.getMonth(), 1);
  const monthEnd = new Date(txn.date.getFullYear(), txn.date.getMonth() + 1, 1);
  const conflict = await TransactionModel.findOne({
    _id: { $ne: txn._id },
    createdBy: userId,
    fixedExpenseId: new mongoose.Types.ObjectId(fixedExpenseId),
    date: { $gte: monthStart, $lt: monthEnd },
  });
  if (conflict) {
    throw new AppError(
      `This fixed expense is already matched to "${conflict.description}" this month`,
      409
    );
  }

  txn.fixedExpenseId = new mongoose.Types.ObjectId(fixedExpenseId);
  await txn.save();
  return txn.toTransaction();
};
