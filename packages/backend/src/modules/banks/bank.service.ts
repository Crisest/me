import { BankModel } from './bank.model';
import { CreateBankPayload } from '@portfolio/common';

export async function createBank(userId: string, data: CreateBankPayload) {
  const iBank = BankModel.fromCreatePayload(data, userId);
  const bank = await BankModel.create(iBank);
  return bank.toBank();
}

export async function getBanksByUser(userId: string) {
  const iBanks = await BankModel.find({ createdBy: userId });
  const banks = iBanks.map(iBank => iBank.toBank());
  return banks || [];
}
