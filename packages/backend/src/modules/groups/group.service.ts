import { Group, IGroup } from './group.model';
import { TransactionModel } from '../transactions/transaction.model';
import { Transaction, TransactionInsights } from '@portfolio/common';
import mongoose from 'mongoose';

export const createGroup = async (
  name: string,
  userId: string
): Promise<IGroup> => {
  const group = new Group({
    name,
    members: [userId],
    createdBy: userId,
  });
  return await group.save();
};

export const getUserGroups = async (userId: string): Promise<IGroup[]> => {
  return await Group.find({ members: userId }).populate('members', 'email');
};

export const addUserToGroup = async (
  groupId: string,
  userId: string
): Promise<IGroup | null> => {
  return await Group.findByIdAndUpdate(
    groupId,
    { $addToSet: { members: userId } },
    { new: true }
  );
};

export const removeUserFromGroup = async (
  groupId: string,
  userId: string
): Promise<IGroup | null> => {
  return await Group.findByIdAndUpdate(
    groupId,
    { $pull: { members: userId } },
    { new: true }
  );
};

export const getGroupTransactions = async (
  groupId: string,
  options: { month?: number; year?: number }
): Promise<Transaction[]> => {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('Group not found');

  const query: Record<string, any> = {
    createdBy: { $in: group.members },
  };

  const { month, year } = options;
  if (month) {
    const yearSelected = year || new Date().getFullYear();
    const startDate = new Date(yearSelected, month - 1, 1);
    const endDate = new Date(yearSelected, month, 1);
    query.date = { $gte: startDate, $lt: endDate };
  }

  const result = await TransactionModel.find(query).sort({ date: -1 });
  return result.map(t => t.toTransaction());
};

export const getGroupInsights = async (
  groupId: string,
  month: number,
  year?: number
): Promise<TransactionInsights> => {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('Group not found');

  const targetYear = year || new Date().getFullYear();
  const startDate = new Date(targetYear, month - 1, 1);
  const endDate = new Date(targetYear, month, 1);

  const memberObjectIds = group.members.map(
    (id: mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id)
  );

  const insights = await TransactionModel.aggregate([
    {
      $match: {
        createdBy: { $in: memberObjectIds },
        date: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $facet: {
        debits: [
          { $match: { amount: { $lt: 0 } } },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: '$amount' },
              debitCount: { $sum: 1 },
              averageDebit: { $avg: '$amount' },
            },
          },
        ],
        credits: [
          { $match: { amount: { $gte: 0 } } },
          {
            $group: {
              _id: null,
              totalIncome: { $sum: '$amount' },
              creditCount: { $sum: 1 },
              averageCredit: { $avg: '$amount' },
            },
          },
        ],
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
    totalIncome: Math.abs(credits.totalIncome),
    netAmount: Math.abs(credits.totalIncome) - Math.abs(debits.totalSpent),
    debitCount: debits.debitCount,
    creditCount: credits.creditCount,
    averageDebit: Math.abs(debits.averageDebit),
    averageCredit: Math.abs(credits.averageCredit),
  };
};
