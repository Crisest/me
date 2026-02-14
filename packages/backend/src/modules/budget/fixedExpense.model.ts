import mongoose, { Document, Model } from 'mongoose';
import { FixedExpense } from '@portfolio/common';

export interface IFixedExpense extends Document {
  name: string;
  amount: number;
  category?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  toFixedExpense(): FixedExpense;
}

const FixedExpenseSchema = new mongoose.Schema<IFixedExpense>(
  {
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

FixedExpenseSchema.methods.toFixedExpense = function (): FixedExpense {
  return {
    id: this._id.toString(),
    name: this.name,
    amount: this.amount,
    category: this.category,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.getTime(),
    updatedAt: this.updatedAt ? this.updatedAt.getTime() : undefined,
    deletedAt: this.deletedAt ? this.deletedAt.getTime() : undefined,
  };
};

export const FixedExpenseModel = mongoose.model<IFixedExpense>(
  'FixedExpense',
  FixedExpenseSchema
);
