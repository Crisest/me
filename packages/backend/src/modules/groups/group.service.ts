import { Group, IGroup } from './group.model';
import { TransactionModel } from '../transactions/transaction.model';
import { BudgetModel } from '../budget/budget.model';
import {
  GroupWithMembers,
  Transaction,
  GroupBudgetInsights,
} from '@portfolio/common';
import mongoose from 'mongoose';
import crypto from 'crypto';

const generateInviteCode = () =>
  crypto.randomBytes(4).toString('base64url').slice(0, 6);

export const createGroup = async (
  name: string,
  userId: string
): Promise<GroupWithMembers> => {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const group = new Group({
        name,
        members: [userId],
        createdBy: userId,
        inviteCode: generateInviteCode(),
      });
      await group.save();
      await group.populate('members', 'email');
      return group.toGroupWithMembers();
    } catch (err: any) {
      if (attempt < maxAttempts - 1 && err?.code === 11000) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique invite code');
};

export const joinGroupByCode = async (
  code: string,
  userId: string
): Promise<GroupWithMembers | null> => {
  const group = await Group.findOneAndUpdate(
    { inviteCode: code },
    { $addToSet: { members: userId } },
    { new: true }
  ).populate('members', 'email');
  return group ? group.toGroupWithMembers() : null;
};

export const getUserGroups = async (
  userId: string
): Promise<GroupWithMembers[]> => {
  const groups = await Group.find({ members: userId }).populate(
    'members',
    'email'
  );
  return groups.map(g => g.toGroupWithMembers());
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

export const deleteGroup = async (
  groupId: string,
  userId: string
): Promise<boolean> => {
  const result = await Group.findOneAndDelete({
    _id: groupId,
    createdBy: userId,
  });
  return result !== null;
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

  const result = await TransactionModel.find(query)
    .populate('createdBy', 'email name')
    .populate({
      path: 'cardId',
      select: 'name bankId',
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
    const owner = t.createdBy as any;
    if (owner && typeof owner === 'object') {
      tx.ownerEmail = owner.email;
      tx.ownerName = owner.name;
    }
    return tx;
  });
};

export const getGroupInsights = async (
  groupId: string,
  month: number,
  year?: number
): Promise<GroupBudgetInsights> => {
  const group = await Group.findById(groupId);
  if (!group) throw new Error('Group not found');

  const targetYear = year || new Date().getFullYear();
  const startDate = new Date(targetYear, month - 1, 1);
  const endDate = new Date(targetYear, month, 1);

  const memberObjectIds = group.members.map(
    (id: mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id)
  );

  // Aggregate transaction spending for all members in the given month
  const insights = await TransactionModel.aggregate([
    {
      $match: {
        createdBy: { $in: memberObjectIds },
        date: { $gte: startDate, $lt: endDate },
      },
    },
    { $match: { amount: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$amount' },
        debitCount: { $sum: 1 },
      },
    },
  ]);

  const debits = insights[0] || { totalSpent: 0, debitCount: 0 };
  const totalSpent = debits.totalSpent;

  // Aggregate all members' personal budgets
  const memberBudgets = await BudgetModel.find({
    createdBy: { $in: memberObjectIds },
  });

  let budget = 0;
  let totalFixed = 0;
  let fixedCount = 0;

  for (const b of memberBudgets) {
    budget += b.salary;
    for (const e of b.fixedExpenses) {
      totalFixed += e.amount;
      fixedCount += 1;
    }
  }

  return {
    totalSpent,
    debitCount: debits.debitCount,
    budget,
    totalFixed,
    fixedCount,
    moneyLeft: budget - totalFixed - totalSpent,
  };
};
