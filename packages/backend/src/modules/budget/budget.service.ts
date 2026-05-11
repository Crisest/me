import { Budget, BudgetPayloads, BudgetOverride, BudgetOverridePayloads } from '@portfolio/common';
import { BudgetModel } from './budget.model';
import { BudgetOverrideModel } from './budgetOverride.model';

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

export const getBudgetOverride = async (
  userId: string,
  month: number,
  year: number
): Promise<BudgetOverride | null> => {
  const result = await BudgetOverrideModel.findOne({ createdBy: userId, month, year });
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
