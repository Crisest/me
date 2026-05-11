import mongoose, { Document } from 'mongoose';
import { BudgetOverride } from '@portfolio/common';

export interface IBudgetOverride extends Document {
  month: number;
  year: number;
  salary: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toBudgetOverride(): BudgetOverride;
}

const BudgetOverrideSchema = new mongoose.Schema<IBudgetOverride>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    salary: { type: Number, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

BudgetOverrideSchema.index({ createdBy: 1, month: 1, year: 1 }, { unique: true });

BudgetOverrideSchema.methods.toBudgetOverride = function (): BudgetOverride {
  return {
    id: this._id.toString(),
    month: this.month,
    year: this.year,
    salary: this.salary,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.getTime(),
    updatedAt: this.updatedAt ? this.updatedAt.getTime() : undefined,
  };
};

export const BudgetOverrideModel = mongoose.model<IBudgetOverride>(
  'BudgetOverride',
  BudgetOverrideSchema
);
