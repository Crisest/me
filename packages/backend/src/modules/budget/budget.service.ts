import { Budget, BudgetPayloads } from '@portfolio/common';
import { BudgetModel } from './budget.model';

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
  const result = await BudgetModel.findOneAndUpdate(
    { createdBy: userId },
    { ...payload, createdBy: userId },
    { upsert: true, new: true, runValidators: true }
  );
  return result.toBudget();
};
