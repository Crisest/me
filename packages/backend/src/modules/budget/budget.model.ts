import mongoose, { Document, Model } from 'mongoose';
import { Budget } from '@portfolio/common';

export interface IBudget extends Document {
  salary: number;
  fixedExpenses: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  toBudget(): Budget;
}

const BudgetSchema = new mongoose.Schema<IBudget>(
  {
    salary: { type: Number, required: true },
    fixedExpenses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FixedExpense',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      sparse: true,
    },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

BudgetSchema.methods.toBudget = function (): Budget {
  return {
    id: this._id.toString(),
    salary: this.salary,
    fixedExpenses: this.fixedExpenses.map((id: mongoose.Types.ObjectId) =>
      id.toString()
    ),
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.getTime(),
    updatedAt: this.updatedAt ? this.updatedAt.getTime() : undefined,
    deletedAt: this.deletedAt ? this.deletedAt.getTime() : undefined,
  };
};

export const BudgetModel = mongoose.model<IBudget>('Budget', BudgetSchema);
