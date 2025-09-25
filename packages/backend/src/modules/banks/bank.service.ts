import { Bank } from './bank.model';
import mongoose from 'mongoose';
import { CreateBankPayload } from '@portfolio/common';

export async function createBank(
  userId: mongoose.Types.ObjectId,
  data: CreateBankPayload
) {
  const iBank = Bank.fromCommonBank(data, userId);
  const bank = await Bank.create(iBank);
  return bank.toBank();
}

export async function getBanksByUser(userId: mongoose.Types.ObjectId) {
  const iBanks = await Bank.find({ createdBy: userId });
  const banks = iBanks.map(iBank => iBank.toBank());
  return banks || [];
}
