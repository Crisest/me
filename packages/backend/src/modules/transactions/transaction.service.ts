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
