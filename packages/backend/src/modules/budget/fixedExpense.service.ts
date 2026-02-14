import mongoose from 'mongoose';
import {
  FixedExpense,
  CreateFixedExpensePayload,
  UpdateFixedExpensePayload,
} from '@portfolio/common';
import { FixedExpenseModel } from './fixedExpense.model';

export const getAllFixedExpensesByUserId = async (
  userId: string
): Promise<FixedExpense[]> => {
  const result = await FixedExpenseModel.find({
    createdBy: userId,
    deletedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  return result.map(expense => expense.toFixedExpense());
};

export const getFixedExpenseById = async (
  id: string,
  userId: string
): Promise<FixedExpense | null> => {
  const result = await FixedExpenseModel.findOne({
    _id: id,
    createdBy: userId,
    deletedAt: { $exists: false },
  });

  return result ? result.toFixedExpense() : null;
};

export const createFixedExpense = async (
  payload: CreateFixedExpensePayload,
  userId: string
): Promise<FixedExpense> => {
  const expense = new FixedExpenseModel({
    ...payload,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  await expense.save();
  return expense.toFixedExpense();
};

export const updateFixedExpense = async (
  id: string,
  payload: UpdateFixedExpensePayload,
  userId: string
): Promise<FixedExpense | null> => {
  const result = await FixedExpenseModel.findOneAndUpdate(
    { _id: id, createdBy: userId, deletedAt: { $exists: false } },
    { $set: payload },
    { new: true }
  );

  return result ? result.toFixedExpense() : null;
};

export const deleteFixedExpense = async (
  id: string,
  userId: string
): Promise<boolean> => {
  const result = await FixedExpenseModel.findOneAndUpdate(
    { _id: id, createdBy: userId, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );

  return !!result;
};
