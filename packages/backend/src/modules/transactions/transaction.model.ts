import mongoose, { Document, Model } from 'mongoose';
import {
  Transaction as CommonTransaction,
  CreateTransactionPayload,
  CreateTransactionsPayload,
} from '@portfolio/common';

export interface ITransaction extends Document {
  amount: number;
  description: string;
  category?: string;
  date: Date;
  groupId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toTransaction(): CommonTransaction;
}

// Add this interface for the model statics
interface TransactionModel extends Model<ITransaction> {
  fromCommonTransaction(
    data: CreateTransactionsPayload,
    userId: mongoose.Types.ObjectId
  ): Partial<ITransaction> | Partial<ITransaction>[];
}

const TransactionSchema = new mongoose.Schema<ITransaction>(
  {
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    category: { type: String },
    date: { type: Date, default: Date.now },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

TransactionSchema.methods.toTransaction = function (): CommonTransaction {
  return {
    id: this._id.toString(),
    amount: this.amount,
    description: this.description,
    category: this.category,
    date: this.date.toISOString(),
    groupId: this.groupId.toString(),
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.toISOString() || null,
    updatedAt: this.updatedAt.toISOString(),
  };
};

TransactionSchema.statics.fromCommonTransaction = function (
  data: CreateTransactionsPayload,
  userId: mongoose.Types.ObjectId
): Partial<ITransaction> | Partial<ITransaction>[] {
  const convert = (tx: CreateTransactionPayload): Partial<ITransaction> => ({
    amount: tx.amount,
    description: tx.description,
    category: tx.category,
    date: new Date(tx.date),
    groupId: new mongoose.Types.ObjectId(tx.groupId),
    createdBy: userId,
    // createdAt and updatedAt are handled by timestamps
  });

  if (Array.isArray(data)) {
    return data.map(convert);
  }
  return convert(data);
};

export const Transaction = mongoose.model<ITransaction, TransactionModel>(
  'Transaction',
  TransactionSchema
);
