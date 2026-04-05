import { TransactionModel } from './transaction.model';
import { Transaction, TransactionPayloads } from '@portfolio/common';
import { createUploadRecord } from '../uploads/upload.service';

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

    query.date = {
      $gte: startDate,
      $lt: endDate,
    };
  }

  const result = await TransactionModel.find(query).sort({ date: -1 });

  return result.map(iTransaction => iTransaction.toTransaction());
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
