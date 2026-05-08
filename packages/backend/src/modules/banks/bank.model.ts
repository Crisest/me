import mongoose, { Document, Model } from 'mongoose';
import { Bank, CreateBankPayload, PlaidStatus } from '@portfolio/common';

export interface IBank extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  isPlaidLinked: boolean;
  plaidAccessToken?: string;
  plaidItemId?: string;
  plaidInstitutionId?: string;
  plaidSyncCursor?: string;
  plaidStatus?: PlaidStatus;
  toBank(): Bank;
}

interface BankModel extends Model<IBank> {
  fromCreatePayload(data: CreateBankPayload, userId: string): Partial<IBank>;
}

const BankSchema = new mongoose.Schema<IBank>(
  {
    name: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPlaidLinked: { type: Boolean, required: true, default: false },
    plaidAccessToken: { type: String },
    plaidItemId: { type: String, index: true },
    plaidInstitutionId: { type: String },
    plaidSyncCursor: { type: String },
    plaidStatus: {
      type: String,
      enum: ['connected', 'login_required', 'error'],
    },
  },
  { timestamps: true }
);

BankSchema.methods.toBank = function (): Bank {
  return {
    id: this._id.toString(),
    name: this.name,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    isPlaidLinked: this.isPlaidLinked,
    plaidStatus: this.plaidStatus,
    plaidInstitutionId: this.plaidInstitutionId,
  };
};

BankSchema.statics.fromCreatePayload = function (
  data: CreateBankPayload,
  userId: string
): Partial<IBank> {
  return {
    name: data.name,
    createdBy: new mongoose.Types.ObjectId(userId),
    isPlaidLinked: false,
  };
};

export const BankModel = mongoose.model<IBank, BankModel>('Bank', BankSchema);
