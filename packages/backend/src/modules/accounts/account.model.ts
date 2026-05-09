import mongoose, { Document, Model } from 'mongoose';
import { Account, AccountType } from '@portfolio/common';

export interface IAccount extends Document {
  bankId: mongoose.Types.ObjectId;
  plaidAccountId: string;
  name: string;
  officialName?: string;
  mask?: string;
  type: AccountType;
  subtype?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toAccount(): Account;
}

const AccountSchema = new mongoose.Schema<IAccount>(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true,
    },
    plaidAccountId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    officialName: { type: String },
    mask: { type: String },
    type: {
      type: String,
      enum: ['depository', 'credit', 'loan', 'investment', 'other'],
      required: true,
    },
    subtype: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

AccountSchema.methods.toAccount = function (): Account {
  return {
    id: this._id.toString(),
    bankId: this.bankId.toString(),
    plaidAccountId: this.plaidAccountId,
    name: this.name,
    officialName: this.officialName,
    mask: this.mask,
    type: this.type,
    subtype: this.subtype,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const AccountModel = mongoose.model<IAccount, Model<IAccount>>(
  'Account',
  AccountSchema
);
