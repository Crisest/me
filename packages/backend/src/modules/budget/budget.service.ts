import mongoose from 'mongoose';
import {
  Budget,
  BudgetPayloads,
  BudgetOverride,
  BudgetOverridePayloads,
} from '@portfolio/common';
import { BudgetModel, FixedExpenseSubdoc } from './budget.model';
import { BudgetOverrideModel } from './budgetOverride.model';
import { TransactionModel } from '../transactions/transaction.model';

export const getBudgetByUserId = async (
  userId: string
): Promise<Budget | null> => {
  const result = await BudgetModel.findOne({ createdBy: userId });
  return result ? result.toBudget() : null;
};

export const upsertBudget = async (
  userId: string,
  payload: BudgetPayloads.Upsert
): Promise<Budget> => {
  const nextSubdocs = payload.fixedExpenses.map(e => ({
    ...(e.id ? { _id: new mongoose.Types.ObjectId(e.id) } : {}),
    name: e.name,
    amount: e.amount,
  }));
  const nextIds = new Set(
    payload.fixedExpenses.map(e => e.id).filter((id): id is string => !!id)
  );

  // Atomic swap: returns the pre-update doc so removedIds can't be invalidated
  // by a racing upsert between read and write.
  const prior = await BudgetModel.findOneAndUpdate(
    { createdBy: userId },
    { salary: payload.salary, fixedExpenses: nextSubdocs, createdBy: userId },
    { upsert: true, new: false, runValidators: true, setDefaultsOnInsert: true }
  );

  const removedIds = (prior?.fixedExpenses ?? [])
    .map((e: FixedExpenseSubdoc) => e._id.toString())
    .filter(id => !nextIds.has(id));

  if (removedIds.length > 0) {
    await TransactionModel.updateMany(
      {
        createdBy: userId,
        fixedExpenseId: {
          $in: removedIds.map(id => new mongoose.Types.ObjectId(id)),
        },
      },
      { $unset: { fixedExpenseId: '' } }
    );
  }

  const updated = await BudgetModel.findOne({ createdBy: userId });
  return updated!.toBudget();
};

export const getBudgetOverride = async (
  userId: string,
  month: number,
  year: number
): Promise<BudgetOverride | null> => {
  const result = await BudgetOverrideModel.findOne({
    createdBy: userId,
    month,
    year,
  });
  return result ? result.toBudgetOverride() : null;
};

export const upsertBudgetOverride = async (
  userId: string,
  payload: BudgetOverridePayloads.Upsert
): Promise<BudgetOverride> => {
  const result = await BudgetOverrideModel.findOneAndUpdate(
    { createdBy: userId, month: payload.month, year: payload.year },
    { ...payload, createdBy: userId },
    { upsert: true, new: true, runValidators: true }
  );
  return result.toBudgetOverride();
};
