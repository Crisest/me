import mongoose, { Document, Model } from 'mongoose';
import { Bank as CommonBank, CreateBankPayload } from '@portfolio/common';

export interface IBank extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toBank(): CommonBank;
}

// Add interface for model statics
interface BankModel extends Model<IBank> {
  fromCommonBank(data: CreateBankPayload, userId: string): Partial<IBank>;
}

const BankSchema = new mongoose.Schema<IBank>(
  {
    name: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

BankSchema.methods.toBank = function (): CommonBank {
  return {
    id: this._id.toString(),
    name: this.name,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

BankSchema.statics.fromCommonBank = function (
  data: CreateBankPayload,
  userId: string
): Partial<IBank> {
  return {
    name: data.name,
    createdBy: new mongoose.Types.ObjectId(userId),
  };
};

export const Bank = mongoose.model<IBank, BankModel>('Bank', BankSchema);
