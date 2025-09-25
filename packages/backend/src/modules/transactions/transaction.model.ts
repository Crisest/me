import mongoose, { Document, Model } from 'mongoose';
import { Transaction as CommonTransaction } from '@portfolio/common';

export interface ITransaction extends Document {
  amount: number;
  description: string;
  category?: string;
  date: Date;
  groupId: mongoose.Types.ObjectId;
  bankId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toTransaction(): CommonTransaction;
  cardId?: mongoose.Types.ObjectId;
}

// Add this interface for the model statics
interface TransactionModel extends Model<ITransaction> {
  fromCommonTransaction(
    data: CommonTransaction[],
    userId: mongoose.Types.ObjectId,
    cardId?: string,
    bankId?: string,
    groupId?: string
  ): Partial<ITransaction>[];
}

const TransactionSchema = new mongoose.Schema<ITransaction>(
  {
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    category: { type: String },
    date: { type: Date, default: Date.now, required: true, index: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
    },
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
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
    cardId: this.cardId?.toString(),
    bankId: this.bankId?.toString(),
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.getTime(),
    updatedAt: this.updatedAt ? this.updatedAt.getTime() : undefined,
  };
};

TransactionSchema.statics.fromCommonTransaction = function (
  data: CommonTransaction[],
  userId: mongoose.Types.ObjectId,
  cardId?: string,
  bankId?: string,
  groupId?: string
): Partial<ITransaction>[] {
  const convert = (tx: CommonTransaction): Partial<ITransaction> => ({
    amount: tx.amount,
    description: tx.description,
    category: tx.category,
    date: new Date(tx.date),
    groupId: new mongoose.Types.ObjectId(groupId),
    bankId: new mongoose.Types.ObjectId(bankId),
    cardId: new mongoose.Types.ObjectId(cardId),
    createdBy: userId,
  });

  return data.map(convert);
};

TransactionSchema.pre('save', function (next) {
  if (this.date) {
    this.date.setUTCHours(0, 0, 0, 0);
  }
  next();
});

export const Transaction = mongoose.model<ITransaction, TransactionModel>(
  'Transaction',
  TransactionSchema
);
