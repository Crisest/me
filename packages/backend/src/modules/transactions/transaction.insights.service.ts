import mongoose from 'mongoose';
import { TransactionInsights } from '@portfolio/common/src/types/Insights';
import { TransactionModel } from './transaction.model';

export const getMonthlyInsights = async (
  userId: mongoose.Types.ObjectId,
  month: number,
  year?: number
): Promise<TransactionInsights> => {
  const targetYear = year || new Date().getFullYear();
  const startDate = new Date(targetYear, month - 1, 1);
  const endDate = new Date(targetYear, month, 1);

  const insights = await TransactionModel.aggregate([
    {
      $match: {
        createdBy: userId,
        date: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $facet: {
        debits: [
          {
            $match: { category: 'Debit' },
          },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: '$amount' },
              debitCount: { $sum: 1 },
              averageDebit: { $avg: '$amount' },
            },
          },
        ],
        // credits: [
        //   {
        //     $match: { category: 'Credit' },
        //   },
        //   {
        //     $group: {
        //       _id: null,
        //       totalIncome: { $sum: '$amount' },
        //       creditCount: { $sum: 1 },
        //       averageCredit: { $avg: '$amount' },
        //     },
        //   },
        // ],
      },
    },
  ]);

  const debits = insights[0].debits[0] || {
    totalSpent: 0,
    debitCount: 0,
    averageDebit: 0,
  };

  const credits = insights[0].credits[0] || {
    totalIncome: 0,
    creditCount: 0,
    averageCredit: 0,
  };

  return {
    totalSpent: Math.abs(debits.totalSpent),
    totalIncome: credits.totalIncome,
    netAmount: credits.totalIncome - Math.abs(debits.totalSpent),
    debitCount: debits.debitCount,
    creditCount: credits.creditCount,
    averageDebit: Math.abs(debits.averageDebit),
    averageCredit: credits.averageCredit,
  };
};
