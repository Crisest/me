import mongoose, { Document } from 'mongoose';

export interface IFixedTransaction extends Document {
  recurrence?: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    daysOfWeek?: number[]; // 0..6
    dayOfMonth?: number;
  };
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
}

const FixedTransactionSchema = new mongoose.Schema<IFixedTransaction>(
  {
    recurrence: {
      freq: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number }],
      dayOfMonth: { type: Number },
    },
    startDate: { type: Date },
    endDate: { type: Date },
    active: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const FixedTransactionModel = mongoose.model<IFixedTransaction>(
  'FixedTransaction',
  FixedTransactionSchema
);
