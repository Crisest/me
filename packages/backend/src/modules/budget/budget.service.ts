import mongoose from 'mongoose';
import {
  Budget,
  CreateBudgetPayload,
  UpdateBudgetPayload,
} from '@portfolio/common';
import { BudgetModel } from './budget.model';

export const getBudgetByUserId = async (
  userId: string
): Promise<Budget | null> => {
  const result = await BudgetModel.findOne({
    createdBy: userId,
    deletedAt: { $exists: false },
  }).populate('fixedExpenses');

  return result ? result.toBudget() : null;
};

export const getOrCreateBudget = async (userId: string): Promise<Budget> => {
  let budget = await BudgetModel.findOne({
    createdBy: userId,
    deletedAt: { $exists: false },
  });

  if (!budget) {
    budget = await BudgetModel.create({
      salary: 0,
      fixedExpenses: [],
      createdBy: new mongoose.Types.ObjectId(userId),
    });
  }

  return budget.toBudget();
};

export const createBudget = async (
  payload: CreateBudgetPayload,
  userId: string
): Promise<Budget> => {
  const budget = new BudgetModel({
    ...payload,
    fixedExpenses:
      payload.fixedExpenseIds?.map(id => new mongoose.Types.ObjectId(id)) || [],
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  await budget.save();
  return budget.toBudget();
};

export const updateBudgetByUserId = async (
  userId: string,
  payload: UpdateBudgetPayload
): Promise<Budget | null> => {
  const updateData: any = {};

  if (payload.salary !== undefined) {
    updateData.salary = payload.salary;
  }

  if (payload.fixedExpenseIds) {
    updateData.fixedExpenses = payload.fixedExpenseIds.map(
      id => new mongoose.Types.ObjectId(id)
    );
  }

  const result = await BudgetModel.findOneAndUpdate(
    { createdBy: userId, deletedAt: { $exists: false } },
    { $set: updateData },
    { new: true }
  ).populate('fixedExpenses');

  return result ? result.toBudget() : null;
};

export const deleteBudget = async (userId: string): Promise<boolean> => {
  const result = await BudgetModel.findOneAndUpdate(
    { createdBy: userId, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );

  return !!result;
};
