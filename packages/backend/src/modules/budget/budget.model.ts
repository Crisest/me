import mongoose, { Document, Types } from 'mongoose';
import { Budget } from '@portfolio/common';

export interface FixedExpenseSubdoc {
  _id: Types.ObjectId;
  name: string;
  amount: number;
}

export interface IBudget extends Document {
  salary: number;
  fixedExpenses: Types.DocumentArray<FixedExpenseSubdoc>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toBudget(): Budget;
}

const FixedExpenseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  { _id: true }
);

const BudgetSchema = new mongoose.Schema<IBudget>(
  {
    salary: { type: Number, required: true },
    fixedExpenses: [FixedExpenseSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

BudgetSchema.methods.toBudget = function (): Budget {
  return {
    id: this._id.toString(),
    salary: this.salary,
    fixedExpenses: this.fixedExpenses.map((e: FixedExpenseSubdoc) => ({
      id: e._id.toString(),
      name: e.name,
      amount: e.amount,
    })),
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.getTime(),
    updatedAt: this.updatedAt ? this.updatedAt.getTime() : undefined,
  };
};

export const BudgetModel = mongoose.model<IBudget>('Budget', BudgetSchema);
